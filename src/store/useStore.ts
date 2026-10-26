import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
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
}

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
}

export const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
}

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
      rememberRoom: (roomId) => setState((s) => ({ recentRooms: [roomId, ...s.recentRooms.filter((id) => id !== roomId)].slice(0, 8) })),
    }),
    {
      name: 'letterboxd2tierlist',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ enrichment: _e, editingFilm: _f, notice: _n, ...persisted }) => persisted,
    },
  ),
)
