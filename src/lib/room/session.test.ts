import { describe, expect, it } from 'vitest'
import { defaultTiers } from '../tiers'
import type { Film, Match } from '../types'
import { MemoryNetwork, type MemoryNode } from './memoryTransport'
import { RoomSession, type SessionView } from './session'
import type { Member, RoomState } from './types'

const film = (id: string, rating: number | null): Film => ({ id, name: id, year: 2000, uri: id, rating, watchedDate: null })

interface Peer {
  node: MemoryNode
  session: RoomSession
  view: () => SessionView
  matches: Record<string, Match>
}

function peer(network: MemoryNetwork, memberId: string, initialState: RoomState | null = null): Peer {
  const node = network.node(`peer-${memberId}`)
  let view: SessionView | null = null
  const matches: Record<string, Match> = {}
  const session = new RoomSession(node, {
    roomId: 'room',
    memberId,
    name: memberId.toUpperCase(),
    initialState,
    onChange: (v) => (view = v),
    getMatches: (ids) => Object.fromEntries(ids.filter((id) => matches[id]).map((id) => [id, matches[id]])),
    onMatches: (m) => Object.assign(matches, m),
  })
  return { node, session, view: () => view!, matches }
}

const member = (id: string, films: Film[]): Member => ({ id, name: id, films })

function boardWith(filmId: string) {
  const tiers = defaultTiers()
  tiers[0].filmIds = [filmId]
  return tiers
}

describe('RoomSession', () => {
  it('hosts when alone', () => {
    const net = new MemoryNetwork()
    const a = peer(net, 'a')
    expect(a.view().isHost).toBe(true)
    a.session.dispatch({ t: 'member', member: member('a', [film('x', 5)]) })
    expect(a.view().state.version).toBe(1)
  })

  it('sends the room to someone who joins', () => {
    const net = new MemoryNetwork()
    const a = peer(net, 'a')
    a.session.dispatch({ t: 'member', member: member('a', [film('x', 5)]) })
    a.matches['x'] = { status: 'notfound' }
    const b = peer(net, 'b')
    net.connect(a.node, b.node)
    net.settle()

    expect(b.view().isHost).toBe(false)
    expect(b.view().hostMemberId).toBe('a')
    expect(b.view().state.members['a'].films).toHaveLength(1)
    expect(b.matches['x']).toEqual({ status: 'notfound' })
    expect(a.view().peers['peer-b']).toEqual({ memberId: 'b', name: 'B' })
  })

  it('keeps everyone in sync through the host', () => {
    const net = new MemoryNetwork()
    const [a, b, c] = ['a', 'b', 'c'].map((id) => peer(net, id))
    a.session.dispatch({ t: 'member', member: member('a', []) })
    net.connect(a.node, b.node)
    net.connect(a.node, c.node)
    net.connect(b.node, c.node)
    net.settle()

    b.session.dispatch({ t: 'board', tiers: boardWith('b-film') })
    c.session.dispatch({ t: 'member', member: member('c', [film('y', 2)]) })
    net.settle()

    for (const p of [a, b, c]) {
      expect(p.view().state.board[0].filmIds).toEqual(['b-film'])
      expect(Object.keys(p.view().state.members).sort()).toEqual(['a', 'c'])
      expect(p.view().state.version).toBe(a.view().state.version)
    }
  })

  it('hands hosting to the smallest member id when the host leaves', () => {
    const net = new MemoryNetwork()
    const [a, b, c] = ['a', 'b', 'c'].map((id) => peer(net, id))
    a.session.dispatch({ t: 'member', member: member('a', []) })
    net.connect(a.node, b.node)
    net.connect(a.node, c.node)
    net.connect(b.node, c.node)
    net.settle()

    a.session.leave()
    net.settle()
    expect(b.view().isHost).toBe(true)
    expect(c.view().hostMemberId).toBe('b')

    c.session.dispatch({ t: 'board', tiers: boardWith('after') })
    net.settle()
    expect(b.view().state.board[0].filmIds).toEqual(['after'])
    expect(b.view().state.members['a']).toBeDefined()
  })

  it('lets the freshest copy win when two hosts meet (room revival)', () => {
    const net = new MemoryNetwork()
    const saved: RoomState = { id: 'room', version: 7, members: { a: member('a', [film('x', 4)]) }, board: boardWith('x'), showdown: { phase: 'idle', round: 0, filmIds: [], tiers: [], boards: {}, votes: {} }, tournament: { bracket: null, votes: {}, log: [] } }
    // The fresh peer has the smaller member id, but the reviver's copy is newer.
    const fresh = peer(net, '0')
    const reviver = peer(net, 'z', saved)
    net.connect(fresh.node, reviver.node)
    net.settle()

    expect(reviver.view().isHost).toBe(true)
    expect(fresh.view().isHost).toBe(false)
    expect(fresh.view().state.board[0].filmIds).toEqual(['x'])
  })

  it('re-shares your films if you shared them before reaching the host', () => {
    const net = new MemoryNetwork()
    const a = peer(net, 'a')
    a.session.dispatch({ t: 'board', tiers: boardWith('host-board') })
    a.session.dispatch({ t: 'board', tiers: boardWith('host-board-2') })
    const b = peer(net, 'b')
    b.session.dispatch({ t: 'member', member: member('b', [film('mine', 3)]) })
    net.connect(a.node, b.node)
    net.settle()

    // a had the newer room, so b follows it, but b's films still make it in.
    expect(b.view().isHost).toBe(false)
    expect(a.view().state.board[0].filmIds).toEqual(['host-board-2'])
    expect(a.view().state.members['b'].films[0].id).toBe('mine')
    expect(b.view().state.members['b']).toBeDefined()
  })

  it('queues ops made while the host is unknown', () => {
    const net = new MemoryNetwork()
    const a = peer(net, 'a')
    a.session.dispatch({ t: 'member', member: member('a', []) })
    const b = peer(net, 'b')
    net.connect(a.node, b.node)
    net.settle()
    a.session.leave()
    net.settle()
    // b is now alone and hosting; c joins with nothing.
    b.session.dispatch({ t: 'board', tiers: boardWith('solo') })
    const c = peer(net, 'c')
    net.connect(b.node, c.node)
    net.settle()
    expect(c.view().state.board[0].filmIds).toEqual(['solo'])
  })

  it('broadcasts poster matches', () => {
    const net = new MemoryNetwork()
    const a = peer(net, 'a')
    const b = peer(net, 'b')
    net.connect(a.node, b.node)
    net.settle()
    a.session.shareMatches({ x: { status: 'notfound' } })
    net.settle()
    expect(b.matches['x']).toEqual({ status: 'notfound' })
  })
})
