import type { Match } from '../types'
import { applyOp, emptyRoomState, normalizeRoomState } from './reducer'
import type { Channel, Transport } from './transport'
import type { Member, Op, RoomState } from './types'

/**
 * Host-authoritative sync over a peer-to-peer mesh.
 *
 * - Everyone keeps a full copy of the room. One peer is the host: it orders ops, numbering them
 *   with `state.version`, and sends a snapshot to anyone who joins.
 * - Others send their ops to the host (and apply them locally right away). The host applies and
 *   broadcasts each op; followers apply ops in version order and ask for a snapshot on any gap.
 * - A peer that is alone hosts. When two hosts meet, an anchored copy (the creator's, or one that
 *   came from the room) beats a fresh one; then the newer state wins (then the smaller member id,
 *   then peer id) and the other becomes a follower. This also lets anyone revive a room from
 *   their saved copy.
 * - When the host leaves, the connected peer with the smallest member id takes over.
 */

interface Hello {
  memberId: string
  name: string
  isHost: boolean
  anchored: boolean
  version: number
}

interface Snapshot {
  hello: Hello
  state: RoomState
  matches: Record<string, Match>
}

interface Sequenced {
  version: number
  op: Op
}

export interface PeerInfo {
  memberId: string
  name: string
}

export interface SessionView {
  state: RoomState
  isHost: boolean
  hostMemberId: string | null
  /** Connected people other than you, by peer id. */
  peers: Record<string, PeerInfo>
  /** False while waiting for the host's copy of the room. */
  synced: boolean
}

export interface SessionOptions {
  roomId: string
  memberId: string
  name: string
  initialState?: RoomState | null
  /** Starting a brand-new room (the creator): the fresh copy is anchored from the start. */
  creating?: boolean
  onChange: (view: SessionView) => void
  /** Poster matches to hand to newcomers along with the room. */
  getMatches: (filmIds: string[]) => Record<string, Match>
  onMatches: (matches: Record<string, Match>) => void
}

interface Rank {
  anchored: boolean
  version: number
  memberId: string
  peerId: string
}

/** Total order used to decide which host wins and who takes over. */
function outranks(a: Rank, b: Rank): boolean {
  if (a.anchored !== b.anchored) return a.anchored
  if (a.version !== b.version) return a.version > b.version
  if (a.memberId !== b.memberId) return a.memberId < b.memberId
  return a.peerId < b.peerId
}

export class RoomSession {
  private state: RoomState
  private isHost = true
  private hostPeerId: string | null = null
  private synced = true
  private readonly peers = new Map<string, Hello>()
  private pending: Op[] = []
  /** What this member last shared, re-sent if a snapshot from the host doesn't have it. */
  private ownMember: Member | null = null
  private readonly hello: Channel<Hello>
  private readonly snapshot: Channel<Snapshot>
  private readonly opRequest: Channel<Op>
  private readonly sequenced: Channel<Sequenced>
  private readonly syncRequest: Channel<null>
  private readonly matches: Channel<Record<string, Match>>
  private readonly transport: Transport
  private readonly options: SessionOptions

  constructor(transport: Transport, options: SessionOptions) {
    this.transport = transport
    this.options = options
    this.state = options.initialState ? normalizeRoomState(options.initialState) : emptyRoomState(options.roomId, options.creating)
    this.ownMember = this.state.members[options.memberId] ?? null

    this.hello = transport.channel<Hello>('hello')
    this.snapshot = transport.channel<Snapshot>('snapshot')
    this.opRequest = transport.channel<Op>('op')
    this.sequenced = transport.channel<Sequenced>('seq')
    this.syncRequest = transport.channel<null>('sync')
    this.matches = transport.channel<Record<string, Match>>('matches')

    transport.onPeerJoin((peerId) => this.hello.send(this.ownHello(), peerId))
    transport.onPeerLeave((peerId) => this.handleLeave(peerId))
    this.hello.onMessage((hello, peerId) => this.handleHello(hello, peerId))
    this.snapshot.onMessage((snapshot, peerId) => this.handleSnapshot(snapshot, peerId))
    this.opRequest.onMessage((op) => {
      if (this.isHost) this.applyAsHost(op)
    })
    this.sequenced.onMessage((message, peerId) => this.handleSequenced(message, peerId))
    this.syncRequest.onMessage((_, peerId) => {
      if (this.isHost) this.sendSnapshot(peerId)
    })
    this.matches.onMessage((matches) => options.onMatches(matches))
    this.emit()
  }

  dispatch(op: Op) {
    if (op.t === 'member' && op.member.id === this.options.memberId) this.ownMember = op.member
    if (op.t === 'member-remove' && op.memberId === this.options.memberId) this.ownMember = null

    if (this.isHost) {
      this.applyAsHost(op)
      return
    }
    this.state = applyOp(this.state, op)
    if (this.hostPeerId && this.synced) this.opRequest.send(op, this.hostPeerId)
    else this.pending.push(op)
    this.emit()
  }

  shareMatches(matches: Record<string, Match>) {
    if (Object.keys(matches).length) this.matches.send(matches)
  }

  setName(name: string) {
    this.options.name = name
    this.hello.send(this.ownHello())
  }

  leave() {
    this.transport.leave()
  }

  private ownHello(): Hello {
    return { memberId: this.options.memberId, name: this.options.name, isHost: this.isHost, anchored: this.state.anchored, version: this.state.version }
  }

  private rank(hello: Hello, peerId: string): Rank {
    // Peers running an older version don't send `anchored`; their copies were always real rooms.
    return { anchored: hello.anchored ?? true, version: hello.version, memberId: hello.memberId, peerId }
  }

  private selfRank() {
    return this.rank(this.ownHello(), this.transport.selfId)
  }

  private handleHello(hello: Hello, peerId: string) {
    this.peers.set(peerId, hello)
    if (this.isHost) {
      if (hello.isHost && outranks(this.rank(hello, peerId), this.selfRank())) this.demote()
      else this.sendSnapshot(peerId)
    }
    if (!this.isHost) this.followBestHost()
    this.emit()
  }

  private handleSnapshot(snapshot: Snapshot, peerId: string) {
    this.peers.set(peerId, snapshot.hello)
    if (this.isHost && snapshot.hello.isHost && outranks(this.rank(snapshot.hello, peerId), this.selfRank())) this.demote()
    if (this.isHost) return
    this.followBestHost()
    if (peerId !== this.hostPeerId) return

    this.state = normalizeRoomState(snapshot.state)
    this.synced = true
    this.options.onMatches(snapshot.matches)
    // Re-share our films if the host's copy lost or never got them (e.g. we shared while offline).
    if (this.ownMember && JSON.stringify(this.state.members[this.ownMember.id]) !== JSON.stringify(this.ownMember)) {
      this.pending.push({ t: 'member', member: this.ownMember })
    }
    const pending = this.pending
    this.pending = []
    for (const op of pending) {
      this.state = applyOp(this.state, op)
      this.opRequest.send(op, peerId)
    }
    this.emit()
  }

  private handleSequenced({ version, op }: Sequenced, peerId: string) {
    if (this.isHost || peerId !== this.hostPeerId || !this.synced) return
    if (version === this.state.version + 1) {
      this.state = { ...applyOp(this.state, op), version }
      this.emit()
    } else if (version > this.state.version + 1) {
      // Missed something: get a fresh copy.
      this.synced = false
      this.syncRequest.send(null, peerId)
    }
  }

  private handleLeave(peerId: string) {
    this.peers.delete(peerId)
    if (!this.isHost && peerId === this.hostPeerId) {
      this.hostPeerId = null
      this.followBestHost()
      if (!this.hostPeerId) this.electNewHost()
    }
    this.emit()
  }

  private applyAsHost(op: Op) {
    this.state = { ...applyOp(this.state, op), version: this.state.version + 1 }
    this.sequenced.send({ version: this.state.version, op })
    this.emit()
  }

  private sendSnapshot(peerId: string) {
    const filmIds = Object.values(this.state.members).flatMap((m) => m.films.map((f) => f.id))
    this.snapshot.send({ hello: this.ownHello(), state: this.state, matches: this.options.getMatches(filmIds) }, peerId)
  }

  private demote() {
    this.isHost = false
    this.synced = false
    this.hostPeerId = null
    // Tell everyone, so peers that were following us look for the real host.
    this.hello.send(this.ownHello())
  }

  /** As a follower, follow the best peer claiming to be host (and fetch its copy if it changed). */
  private followBestHost() {
    let best: string | null = null
    for (const [peerId, hello] of this.peers) {
      if (!hello.isHost) continue
      const bestHello = best ? this.peers.get(best)! : null
      if (!bestHello || outranks(this.rank(hello, peerId), this.rank(bestHello, best!))) best = peerId
    }
    if (best && best !== this.hostPeerId) {
      this.hostPeerId = best
      this.synced = false
      this.syncRequest.send(null, best)
    } else if (!best) {
      this.hostPeerId = null
    }
  }

  private electNewHost() {
    const candidates = [{ memberId: this.options.memberId, peerId: this.transport.selfId }, ...[...this.peers].map(([peerId, h]) => ({ memberId: h.memberId, peerId }))]
    const winner = candidates.reduce((a, b) => (outranks({ anchored: true, version: 0, ...b }, { anchored: true, version: 0, ...a }) ? b : a))
    if (winner.peerId !== this.transport.selfId) return
    this.isHost = true
    this.synced = true
    const pending = this.pending
    this.pending = []
    this.hello.send(this.ownHello())
    for (const op of pending) this.applyAsHost(op)
  }

  private emit() {
    const peers: Record<string, PeerInfo> = {}
    for (const [peerId, hello] of this.peers) peers[peerId] = { memberId: hello.memberId, name: hello.name }
    this.options.onChange({
      state: this.state,
      isHost: this.isHost,
      hostMemberId: this.isHost ? this.options.memberId : ((this.hostPeerId && this.peers.get(this.hostPeerId)?.memberId) ?? null),
      peers,
      synced: this.isHost || this.synced,
    })
  }
}
