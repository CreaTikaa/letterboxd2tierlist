import { titleKey } from './letterboxd/parse'
import { RATING_VALUES } from './ratings'
import type { Credits, Film, Filters, LetterboxdList, Match, PoolSort } from './types'

export const DEFAULT_FILTERS: Filters = {
  ratings: [...RATING_VALUES],
  includeUnrated: true,
  search: '',
  yearMin: null,
  yearMax: null,
  genres: [],
  source: 'all',
  person: null,
}

/**
 * The films a view starts from: everything watched, liked films, or one list (in list order, using
 * your watched copy, with its rating, when there is one).
 */
export function sourceFilms(films: Film[], lists: LetterboxdList[], source = 'all'): Film[] {
  if (source === 'liked') return films.filter((f) => f.liked)
  const list = source.startsWith('list:') ? lists.find((l) => l.id === source.slice(5)) : undefined
  if (!list) return films
  const byId = new Map(films.map((f) => [f.id, f]))
  const byTitle = new Map(films.map((f) => [titleKey(f), f]))
  const seen = new Set<string>()
  return list.films.flatMap((entry) => {
    const film = byId.get(entry.id) ?? byTitle.get(titleKey(entry)) ?? entry
    if (seen.has(film.id)) return []
    seen.add(film.id)
    return [film]
  })
}

export function genresOf(match: Match | undefined): number[] | undefined {
  return match?.status === 'matched' ? match.genreIds : undefined
}

/** Does the film's cast & crew include this person? (false when credits aren't loaded) */
export function hasPerson(match: Match | undefined, credits: Record<number, Credits>, person: number): boolean {
  const entry = match?.status === 'matched' ? credits[match.tmdbId] : undefined
  return Boolean(entry && (entry.directors.some(([id]) => id === person) || entry.cast.some(([id]) => id === person)))
}

export interface PersonCount {
  id: number
  name: string
  directed: number
  acted: number
}

/** Everyone credited on the given films, with how many they directed / appeared in. */
export function peopleIndex(films: Film[], matches: Record<string, Match>, credits: Record<number, Credits>): PersonCount[] {
  const people = new Map<number, PersonCount>()
  const seenFilms = new Set<number>()
  for (const film of films) {
    const match = matches[film.id]
    const entry = match?.status === 'matched' ? credits[match.tmdbId] : undefined
    if (!entry || match?.status !== 'matched' || seenFilms.has(match.tmdbId)) continue
    seenFilms.add(match.tmdbId)
    for (const [id, name] of entry.directors) {
      const person = people.get(id) ?? { id, name, directed: 0, acted: 0 }
      person.directed++
      people.set(id, person)
    }
    for (const [id, name] of entry.cast) {
      const person = people.get(id) ?? { id, name, directed: 0, acted: 0 }
      person.acted++
      people.set(id, person)
    }
  }
  return [...people.values()]
}

/** Lower case, without accents or punctuation: "Amélie" matches "amelie", "Mission: Impossible" matches "mission impossible". */
export const foldText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Films whose title (or "title year") contains the query, titles that start with it first. */
export function findFilms(films: Film[], query: string, limit = 8): Film[] {
  const folded = foldText(query)
  if (!folded) return []
  const starts: Film[] = []
  const contains: Film[] = []
  for (const film of films) {
    const text = foldText(`${film.name} ${film.year ?? ''}`)
    if (text.startsWith(folded)) starts.push(film)
    else if (text.includes(folded)) contains.push(film)
  }
  const byName = (a: Film, b: Film) => a.name.localeCompare(b.name) || (a.year ?? 0) - (b.year ?? 0)
  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit)
}

/** `matches` is needed for the genre filter, `credits` for the person filter. */
export function filterFilms(films: Film[], filters: Filters, matches: Record<string, Match> = {}, credits: Record<number, Credits> = {}): Film[] {
  const allowed = new Set(filters.ratings)
  const query = foldText(filters.search)
  // Saved filters from before genres existed have no `genres`.
  const genres = new Set(filters.genres ?? [])
  return films.filter((film) => {
    if (film.rating == null ? !filters.includeUnrated : !allowed.has(film.rating)) return false
    if (query && !foldText(film.name).includes(query)) return false
    if (filters.yearMin != null && (film.year == null || film.year < filters.yearMin)) return false
    if (filters.yearMax != null && (film.year == null || film.year > filters.yearMax)) return false
    if (genres.size && !genresOf(matches[film.id])?.some((g) => genres.has(g))) return false
    if (filters.person != null && !hasPerson(matches[film.id], credits, filters.person)) return false
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
