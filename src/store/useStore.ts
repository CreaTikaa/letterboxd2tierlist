import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import type { SaveFile } from '../lib/export/saveFile'
import { DEFAULT_FILTERS } from '../lib/filter'
import { randomId } from '../lib/random'
import { defaultRatingMap, defaultTiers } from '../lib/tiers'
import type { Tournament } from '../lib/tournament'
import type { Film, Filters, Match, PoolSort, RatingMap, Tier } from '../lib/types'

export interface Enrichment {
  running: boolean
  done: number
  total: number
  error: string | null
}

export interface Notice {
  kind: 'error' | 'success'
  text: string
}

interface State {
  films: Film[]
  matches: Record<string, Match>
  tmdbKey: string
  filters: Filters
  tiers: Tier[]
  ratingMap: RatingMap
  poolSort: PoolSort
  cardWidth: number
  showRatings: boolean
  enrichment: Enrichment
  /** Film whose details/TMDB match are shown in the match dialog. */
  editingFilm: Film | null
  notice: Notice | null
  /** Identity used in rooms; memberId is stable per browser. */
  profile: { memberId: string; name: string }
  tournament: Tournament | null
  /** Room codes visited, most recent first. */
  recentRooms: string[]
  /** Room passwords you've used, so rejoining doesn't ask again. */
  roomPasswords: Record<string, string>
}

type PersistedState = Omit<State, 'enrichment' | 'editingFilm' | 'notice'>

interface Actions {
  importFilms: (films: Film[]) => void
  setTmdbKey: (key: string) => void
  setFilters: (filters: Partial<Filters>) => void
  setMatches: (matches: Record<string, Match>) => void
  setEnrichment: (enrichment: Partial<Enrichment>) => void
  setTiers: (tiers: Tier[]) => void
  setRatingMap: (map: RatingMap) => void
  setPoolSort: (sort: PoolSort) => void
  setCardWidth: (width: number) => void
  setShowRatings: (show: boolean) => void
  setEditingFilm: (film: Film | null) => void
  loadSave: (save: SaveFile) => void
  clearMatches: () => void
  resetAll: () => void
  notify: (notice: Notice | null) => void
  setProfileName: (name: string) => void
  setTournament: (tournament: Tournament | null) => void
  rememberRoom: (roomId: string) => void
  setRoomPassword: (roomId: string, password: string) => void
}

/**
 * IndexedDB storage for the persisted state. The state (whole library + poster cache) is stored as
 * an object, not a JSON string, and writes are batched: zustand calls `setItem` on every change,
 * and serialising everything for each drag or poster batch would be wasteful. A short delay keeps
 * a reload right after a change safe; pending writes are also flushed when the tab is hidden.
 */
const pendingWrites = new Map<string, unknown>()
let writeTimer: ReturnType<typeof setTimeout> | null = null

function flushWrites() {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = null
  for (const [name, value] of pendingWrites) void set(name, value)
  pendingWrites.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushWrites)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushWrites())
}

function idbStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      const value = pendingWrites.get(name) ?? (await get(name))
      // Older versions stored a JSON string.
      return (typeof value === 'string' ? JSON.parse(value) : (value ?? null)) as StorageValue<S> | null
    },
    setItem: (name, value) => {
      pendingWrites.set(name, value)
      writeTimer ??= setTimeout(flushWrites, 150)
    },
    removeItem: (name) => {
      pendingWrites.delete(name)
      return del(name)
    },
  }
}

/** How many rooms keep a local copy (and show under "Recent rooms"). */
const RECENT_ROOMS = 8

const initialTiers = defaultTiers()

const initialState: State = {
  films: [],
  matches: {},
  tmdbKey: '',
  filters: DEFAULT_FILTERS,
  tiers: initialTiers,
  ratingMap: defaultRatingMap(initialTiers),
  poolSort: 'rating',
  cardWidth: 72,
  showRatings: true,
  enrichment: { running: false, done: 0, total: 0, error: null },
  editingFilm: null,
  notice: null,
  profile: { memberId: randomId(12), name: '' },
  tournament: null,
  recentRooms: [],
  roomPasswords: {},
}

export const useStore = create<State & Actions>()(
  persist(
    (setState) => ({
      ...initialState,

      importFilms: (films) =>
        setState((s) => {
          const ids = new Set(films.map((f) => f.id))
          return {
            films,
            // Keep placements for films that are still in the export.
            tiers: s.tiers.map((t) => ({ ...t, filmIds: t.filmIds.filter((id) => ids.has(id)) })),
          }
        }),
      setTmdbKey: (tmdbKey) => setState({ tmdbKey: tmdbKey.trim() }),
      setFilters: (filters) => setState((s) => ({ filters: { ...s.filters, ...filters } })),
      setMatches: (matches) => setState((s) => ({ matches: { ...s.matches, ...matches } })),
      setEnrichment: (enrichment) => setState((s) => ({ enrichment: { ...s.enrichment, ...enrichment } })),
      setTiers: (tiers) => setState({ tiers }),
      setRatingMap: (ratingMap) => setState({ ratingMap }),
      setPoolSort: (poolSort) => setState({ poolSort }),
      setCardWidth: (cardWidth) => setState({ cardWidth }),
      setShowRatings: (showRatings) => setState({ showRatings }),
      setEditingFilm: (editingFilm) => setState({ editingFilm }),
      loadSave: (save) =>
        setState((s) => ({
          films: save.films,
          matches: { ...s.matches, ...save.matches },
          tiers: save.tiers,
          ratingMap: save.ratingMap ?? defaultRatingMap(save.tiers),
          filters: { ...DEFAULT_FILTERS, ...save.filters },
        })),
      clearMatches: () => setState((s) => ({ matches: Object.fromEntries(Object.entries(s.matches).filter(([, m]) => m.status === 'matched' && m.manual)) })),
      resetAll: () => setState((s) => ({ ...initialState, tmdbKey: s.tmdbKey, profile: s.profile })),
      notify: (notice) => setState({ notice }),
      setProfileName: (name) => setState((s) => ({ profile: { ...s.profile, name: name.slice(0, 24) } })),
      setTournament: (tournament) => setState({ tournament }),
      setRoomPassword: (roomId, password) =>
        setState((s) => {
          const { [roomId]: _old, ...rest } = s.roomPasswords
          return { roomPasswords: password ? { ...rest, [roomId]: password } : rest }
        }),
      rememberRoom: (roomId) =>
        setState((s) => {
          const recentRooms = [roomId, ...s.recentRooms.filter((id) => id !== roomId)]
          // Forget rooms that fall off the list, including their saved copy.
          for (const old of recentRooms.slice(RECENT_ROOMS)) void del(`room:${old}`)
          return { recentRooms: recentRooms.slice(0, RECENT_ROOMS) }
        }),
    }),
    {
      name: 'letterboxd2tierlist',
      version: 1,
      storage: idbStorage<PersistedState>(),
      // Data only: transient UI state is left out, and actions can't be stored as objects.
      partialize: ({ enrichment: _e, editingFilm: _f, notice: _n, ...rest }) =>
        Object.fromEntries(Object.entries(rest).filter(([, value]) => typeof value !== 'function')) as PersistedState,
    },
  ),
)
