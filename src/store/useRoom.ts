import { get, set } from 'idb-keyval'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { autoResolve } from '../lib/room/groupTournament'
import { RoomSession, type SessionView } from '../lib/room/session'
import type { Op, RoomState } from '../lib/room/types'
import type { Match, Tier } from '../lib/types'
import { useStore } from './useStore'

interface RoomStore {
  roomId: string | null
  view: SessionView | null
  error: string | null
  join: (roomId: string) => Promise<void>
  leave: () => void
  dispatch: (op: Op) => void
}

let session: RoomSession | null = null
let cleanup: (() => void) | null = null
/** Bumped by every join/leave so a join that's still loading knows it was superseded. */
let joinToken = 0

const snapshotKey = (roomId: string) => `room:${roomId}`

/** Everyone currently connected, including you. */
export function onlineMemberIds(view: SessionView, selfId: string): string[] {
  return [...new Set([selfId, ...Object.values(view.peers).map((p) => p.memberId)])]
}

function throttle(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      fn()
    }, ms)
  }
}

/** Merges matches from other peers without overwriting posters picked by hand here. */
function receiveMatches(incoming: Record<string, Match>) {
  const { matches, setMatches } = useStore.getState()
  const accepted = Object.fromEntries(
    Object.entries(incoming).filter(([id, match]) => {
      const local = matches[id]
      if (!local) return true
      if (local.status === 'matched' && local.manual) return match.status === 'matched' && match.manual === true
      return match.status === 'matched' && (local.status !== 'matched' || match.manual === true)
    }),
  )
  if (Object.keys(accepted).length) setMatches(accepted)
}

export const useRoom = create<RoomStore>()((setState, getState) => ({
  roomId: null,
  view: null,
  error: null,

  join: async (roomId) => {
    if (getState().roomId === roomId && session) return
    getState().leave()
    const token = ++joinToken
    setState({ roomId, view: null, error: null })
    useStore.getState().rememberRoom(roomId)

    // The WebRTC library is only downloaded once someone opens a room.
    const [saved, { trysteroTransport }] = await Promise.all([get<RoomState>(snapshotKey(roomId)), import('../lib/room/trystero')])
    if (token !== joinToken) return // left (or rejoined) while loading

    let latest: RoomState | null = saved ?? null
    const save = throttle(() => latest && void set(snapshotKey(roomId), latest), 1000)
    const { profile } = useStore.getState()
    // While applying matches from peers, don't echo them back.
    let receiving = false
    let resolveTimer: ReturnType<typeof setTimeout> | null = null
    // As host, close a tournament match once everyone online has voted. The short delay lets the
    // last vote show up on everyone's screen before the next match replaces it.
    const scheduleAutoResolve = (view: SessionView) => {
      if (!view.isHost || resolveTimer || !autoResolve(view.state, onlineMemberIds(view, profile.memberId))) return
      resolveTimer = setTimeout(() => {
        resolveTimer = null
        const now = getState().view
        const op = now?.isHost && autoResolve(now.state, onlineMemberIds(now, profile.memberId))
        if (op) session?.dispatch(op)
      }, 700)
    }

    const transport = trysteroTransport(roomId, (message) => setState({ error: message }))
    const current = new RoomSession(transport, {
      roomId,
      memberId: profile.memberId,
      name: profile.name || 'Anonymous',
      initialState: saved,
      onChange: (view) => {
        latest = view.state
        save()
        setState({ view })
        scheduleAutoResolve(view)
      },
      getMatches: (ids) => {
        const { matches } = useStore.getState()
        return Object.fromEntries(ids.filter((id) => matches[id]).map((id) => [id, matches[id]]))
      },
      onMatches: (incoming) => {
        receiving = true
        try {
          receiveMatches(incoming)
        } finally {
          receiving = false
        }
      },
    })
    session = current

    // Share poster matches found (or fixed by hand) here with the rest of the room.
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.profile.name !== previous.profile.name) current.setName(state.profile.name || 'Anonymous')
      if (receiving || state.matches === previous.matches) return
      const roomFilmIds = new Set(Object.values(getState().view?.state.members ?? {}).flatMap((m) => m.films.map((f) => f.id)))
      const changed: Record<string, Match> = {}
      for (const [id, match] of Object.entries(state.matches)) {
        if (match !== previous.matches[id] && roomFilmIds.has(id)) changed[id] = match
      }
      current.shareMatches(changed)
    })

    cleanup = () => {
      if (resolveTimer) clearTimeout(resolveTimer)
      unsubscribe()
      if (latest) void set(snapshotKey(roomId), latest)
      current.leave()
    }
  },

  leave: () => {
    joinToken++
    cleanup?.()
    cleanup = null
    session = null
    setState({ roomId: null, view: null, error: null })
  },

  dispatch: (op) => session?.dispatch(op),
}))

/** Private showdown boards, kept per room and round until they're locked in. */
interface DraftStore {
  drafts: Record<string, Tier[]>
  setDraft: (key: string, tiers: Tier[]) => void
}

export const useShowdownDrafts = create<DraftStore>()(
  persist(
    (setState) => ({
      drafts: {},
      setDraft: (key, tiers) => setState((s) => ({ drafts: { ...s.drafts, [key]: tiers } })),
    }),
    { name: 'letterboxd2tierlist-drafts', storage: createJSONStorage(() => localStorage) },
  ),
)
