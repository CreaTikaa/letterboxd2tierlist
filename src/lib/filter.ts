import { RATING_VALUES } from './ratings'
import type { Film, Filters, Match, PoolSort } from './types'

export const DEFAULT_FILTERS: Filters = {
  ratings: [...RATING_VALUES],
  includeUnrated: true,
  search: '',
  yearMin: null,
  yearMax: null,
  genres: [],
}

export function genresOf(match: Match | undefined): number[] | undefined {
  return match?.status === 'matched' ? match.genreIds : undefined
}

/** `matches` is only needed for the genre filter. */
export function filterFilms(films: Film[], filters: Filters, matches: Record<string, Match> = {}): Film[] {
  const allowed = new Set(filters.ratings)
  const query = filters.search.trim().toLowerCase()
  // Saved filters from before genres existed have no `genres`.
  const genres = new Set(filters.genres ?? [])
  return films.filter((film) => {
    if (film.rating == null ? !filters.includeUnrated : !allowed.has(film.rating)) return false
    if (query && !film.name.toLowerCase().includes(query)) return false
    if (filters.yearMin != null && (film.year == null || film.year < filters.yearMin)) return false
    if (filters.yearMax != null && (film.year == null || film.year > filters.yearMax)) return false
    if (genres.size && !genresOf(matches[film.id])?.some((g) => genres.has(g))) return false
    return true
  })
}

export function sortFilms(films: Film[], sort: PoolSort): Film[] {
  const byName = (a: Film, b: Film) => a.name.localeCompare(b.name)
  const compare: Record<PoolSort, (a: Film, b: Film) => number> = {
    rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b),
    title: byName,
    year: (a, b) => (b.year ?? 0) - (a.year ?? 0) || byName(a, b),
    watched: (a, b) => (b.watchedDate ?? '').localeCompare(a.watchedDate ?? '') || byName(a, b),
  }
  return [...films].sort(compare[sort])
}

/** How many films have each genre (films without genre data are skipped). */
export function countByGenre(films: Film[], matches: Record<string, Match>): Map<number, number> {
  const counts = new Map<number, number>()
  for (const film of films) for (const genre of genresOf(matches[film.id]) ?? []) counts.set(genre, (counts.get(genre) ?? 0) + 1)
  return counts
}

export function countByRating(films: Film[]): Map<number | null, number> {
  const counts = new Map<number | null, number>()
  for (const film of films) counts.set(film.rating, (counts.get(film.rating) ?? 0) + 1)
  return counts
}
