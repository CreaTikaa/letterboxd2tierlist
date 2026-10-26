import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { SaveFile } from '../lib/export/saveFile'
import { DEFAULT_FILTERS } from '../lib/filter'
import { TIER_COLORS, autoFill, defaultRatingMap, defaultTiers, newTierId } from '../lib/tiers'
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
  /** Film whose TMDB match is being fixed in the match dialog. */
  editingFilmId: string | null
  notice: Notice | null
}

interface Actions {
  importFilms: (films: Film[]) => void
  setTmdbKey: (key: string) => void
  setFilters: (filters: Partial<Filters>) => void
  setMatches: (matches: Record<string, Match>) => void
  setEnrichment: (enrichment: Partial<Enrichment>) => void
  setTiers: (tiers: Tier[]) => void
  updateTier: (id: string, changes: Partial<Omit<Tier, 'id'>>) => void
  addTier: () => void
  removeTier: (id: string) => void
  moveTier: (id: string, offset: -1 | 1) => void
  setRatingMap: (map: RatingMap) => void
  autoFill: (films: Film[]) => void
  clearBoard: () => void
  setPoolSort: (sort: PoolSort) => void
  setCardWidth: (width: number) => void
  setShowRatings: (show: boolean) => void
  setEditingFilm: (id: string | null) => void
  loadSave: (save: SaveFile) => void
  clearMatches: () => void
  resetAll: () => void
  notify: (notice: Notice | null) => void
}

const idbStorage: StateStorage = {
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
  editingFilmId: null,
  notice: null,
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
      updateTier: (id, changes) => setState((s) => ({ tiers: s.tiers.map((t) => (t.id === id ? { ...t, ...changes } : t)) })),
      addTier: () =>
        setState((s) => ({
          tiers: [...s.tiers, { id: newTierId(), label: 'New', color: TIER_COLORS[s.tiers.length % TIER_COLORS.length], filmIds: [] }],
        })),
      removeTier: (id) =>
        setState((s) => ({
          tiers: s.tiers.filter((t) => t.id !== id),
          ratingMap: Object.fromEntries(Object.entries(s.ratingMap).map(([r, tierId]) => [r, tierId === id ? '' : tierId])),
        })),
      moveTier: (id, offset) =>
        setState((s) => {
          const from = s.tiers.findIndex((t) => t.id === id)
          const to = from + offset
          if (from < 0 || to < 0 || to >= s.tiers.length) return {}
          const tiers = [...s.tiers]
          ;[tiers[from], tiers[to]] = [tiers[to], tiers[from]]
          return { tiers }
        }),
      setRatingMap: (ratingMap) => setState({ ratingMap }),
      autoFill: (films) => setState((s) => ({ tiers: autoFill(s.tiers, films, s.ratingMap) })),
      clearBoard: () => setState((s) => ({ tiers: s.tiers.map((t) => ({ ...t, filmIds: [] })) })),
      setPoolSort: (poolSort) => setState({ poolSort }),
      setCardWidth: (cardWidth) => setState({ cardWidth }),
      setShowRatings: (showRatings) => setState({ showRatings }),
      setEditingFilm: (editingFilmId) => setState({ editingFilmId }),
      loadSave: (save) =>
        setState((s) => ({
          films: save.films,
          matches: { ...s.matches, ...save.matches },
          tiers: save.tiers,
          ratingMap: save.ratingMap ?? defaultRatingMap(save.tiers),
          filters: { ...DEFAULT_FILTERS, ...save.filters },
        })),
      clearMatches: () => setState((s) => ({ matches: Object.fromEntries(Object.entries(s.matches).filter(([, m]) => m.status === 'matched' && m.manual)) })),
      resetAll: () => setState((s) => ({ ...initialState, tmdbKey: s.tmdbKey })),
      notify: (notice) => setState({ notice }),
    }),
    {
      name: 'letterboxd2tierlist',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ enrichment: _e, editingFilmId: _id, notice: _n, ...persisted }) => persisted,
    },
  ),
)
