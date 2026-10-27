import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import { detectLanguage, type Language } from '../i18n/languages'
import type { SaveFile } from '../lib/export/saveFile'
import { DEFAULT_FILTERS } from '../lib/filter'
import { randomId } from '../lib/random'
import { defaultRatingMap, defaultTiers } from '../lib/tiers'
import type { RankSession } from '../lib/rank'
import type { Tournament } from '../lib/tournament'
import type { Credits, Film, Filters, LetterboxdList, Match, PoolSort, RatingMap, Tier } from '../lib/types'

export type EnrichmentError = { code: 'invalidKey' } | { code: 'failed'; count: number }

export interface Enrichment {
  running: boolean
  done: number
  total: number
  error: EnrichmentError | null
}

export interface Notice {
  kind: 'error' | 'success'
  text: string
}

interface State {
  films: Film[]
  /** The user's Letterboxd lists, from the export. */
  lists: LetterboxdList[]
  matches: Record<string, Match>
  /** Cast & crew by TMDB id, fetched on demand for the people filter. */
  credits: Record<number, Credits>
  /** Progress of the cast & crew lookup (not persisted). */
  creditsProgress: { done: number; total: number } | null
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
  /** "Rank everything" in progress or finished. */
  ranking: RankSession | null
  /** Room codes visited, most recent first. */
  recentRooms: string[]
  /** Room passwords you've used, so rejoining doesn't ask again. */
  roomPasswords: Record<string, string>
  language: Language
}

type PersistedState = Omit<State, 'enrichment' | 'editingFilm' | 'notice' | 'creditsProgress'>

interface Actions {
  importFilms: (films: Film[], lists?: LetterboxdList[]) => void
  setTmdbKey: (key: string) => void
  setFilters: (filters: Partial<Filters>) => void
  setMatches: (matches: Record<string, Match>) => void
  setCredits: (credits: Record<number, Credits>) => void
  setCreditsProgress: (progress: { done: number; total: number } | null) => void
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
  setRanking: (ranking: RankSession | null) => void
  rememberRoom: (roomId: string) => void
  setRoomPassword: (roomId: string, password: string) => void
  setLanguage: (language: Language) => void
}

/**
 * IndexedDB storage for the persisted state. The state (whole library + poster cache) is stored as
 * an object, not a JSON string, and writes are batched: zustand calls `setItem` on every change,
 * and serialising everything for each drag or poster batch would be wasteful. Pending writes are
 * flushed when the tab is hidden. An IndexedDB write started as the page unloads may never finish,
 * so unsaved changes are also copied to localStorage then (synchronous), and picked up on the
 * next load.
 */
const pendingWrites = new Map<string, unknown>()
let writeTimer: ReturnType<typeof setTimeout> | null = null
const unloadKey = (name: string) => `unsaved:${name}`

function flushWrites() {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = null
  for (const [name, value] of pendingWrites) void set(name, value)
  pendingWrites.clear()
}

function rescueWrites() {
  for (const [name, value] of pendingWrites) {
    try {
      localStorage.setItem(unloadKey(name), JSON.stringify(value))
    } catch {
      // Too big for localStorage (or blocked): the IndexedDB write below is all we can do.
    }
  }
  flushWrites()
}

/** Changes rescued when the last page unloaded, if any (read once). */
function takeRescued(name: string): unknown {
  try {
    const text = localStorage.getItem(unloadKey(name))
    if (text == null) return undefined
    localStorage.removeItem(unloadKey(name))
    const value: unknown = JSON.parse(text)
    void set(name, value)
    return value
  } catch {
    return undefined
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', rescueWrites)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushWrites())
}

function idbStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      const value = pendingWrites.get(name) ?? takeRescued(name) ?? (await get(name))
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
  lists: [],
  matches: {},
  credits: {},
  creditsProgress: null,
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
  ranking: null,
  recentRooms: [],
  roomPasswords: {},
  language: detectLanguage(),
}

export const useStore = create<State & Actions>()(
  persist(
    (setState) => ({
      ...initialState,

      importFilms: (films, lists = []) =>
        setState((s) => {
          const ids = new Set([...films, ...lists.flatMap((l) => l.films)].map((f) => f.id))
          const source = s.filters.source ?? 'all'
          return {
            films,
            lists,
            // A list that's gone from the new export can't stay selected.
            filters: source.startsWith('list:') && !lists.some((l) => `list:${l.id}` === source) ? { ...s.filters, source: 'all' } : s.filters,
            // Keep placements for films that are still in the export.
            tiers: s.tiers.map((t) => ({ ...t, filmIds: t.filmIds.filter((id) => ids.has(id)) })),
          }
        }),
      setTmdbKey: (tmdbKey) => setState({ tmdbKey: tmdbKey.trim() }),
      setFilters: (filters) => setState((s) => ({ filters: { ...s.filters, ...filters } })),
      setMatches: (matches) => setState((s) => ({ matches: { ...s.matches, ...matches } })),
      setCredits: (credits) => setState((s) => ({ credits: { ...s.credits, ...credits } })),
      setCreditsProgress: (creditsProgress) => setState({ creditsProgress }),
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
          lists: save.lists ?? [],
          matches: { ...s.matches, ...save.matches },
          tiers: save.tiers,
          ratingMap: save.ratingMap ?? defaultRatingMap(save.tiers),
          filters: { ...DEFAULT_FILTERS, ...save.filters },
        })),
      clearMatches: () => setState((s) => ({ matches: Object.fromEntries(Object.entries(s.matches).filter(([, m]) => m.status === 'matched' && m.manual)) })),
      resetAll: () => setState((s) => ({ ...initialState, tmdbKey: s.tmdbKey, profile: s.profile, language: s.language })),
      notify: (notice) => setState({ notice }),
      setProfileName: (name) => setState((s) => ({ profile: { ...s.profile, name: name.slice(0, 24) } })),
      setTournament: (tournament) => setState({ tournament }),
      setRanking: (ranking) => setState({ ranking }),
      setLanguage: (language) => setState({ language }),
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
      partialize: ({ enrichment: _e, editingFilm: _f, notice: _n, creditsProgress: _c, ...rest }) =>
        Object.fromEntries(Object.entries(rest).filter(([, value]) => typeof value !== 'function')) as PersistedState,
    },
  ),
)
