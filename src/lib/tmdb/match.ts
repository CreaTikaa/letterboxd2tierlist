import type { Film, Match } from '../types'
import { searchMovies, type SearchOptions, type TmdbMovie } from './client'

export function normalizeTitle(title: string): string {
  const latin = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  // Non-Latin titles would normalize to nothing; compare them as-is instead.
  return latin || title.trim().toLowerCase()
}

export function releaseYear(movie: TmdbMovie): number | null {
  const year = Number(movie.release_date?.slice(0, 4))
  return year || null
}

function score(movie: TmdbMovie, index: number, title: string, year: number | null): number {
  let total = -index // TMDB's own relevance order
  if (normalizeTitle(movie.title) === title || normalizeTitle(movie.original_title) === title) total += 100
  const movieYear = releaseYear(movie)
  if (year != null && movieYear != null) {
    const diff = Math.abs(movieYear - year)
    total += diff === 0 ? 50 : diff === 1 ? 25 : 0
  }
  return total + Math.min(movie.popularity ?? 0, 100) / 10
}

export function pickBest(results: TmdbMovie[], name: string, year: number | null): { movie: TmdbMovie; score: number } | null {
  const title = normalizeTitle(name)
  let best: { movie: TmdbMovie; score: number } | null = null
  for (const [i, movie] of results.entries()) {
    const s = score(movie, i, title, year)
    if (!best || s > best.score) best = { movie, score: s }
  }
  return best
}

export const toMatch = (movie: TmdbMovie, manual = false): Match => ({
  status: 'matched',
  tmdbId: movie.id,
  title: movie.title,
  year: releaseYear(movie),
  posterPath: movie.poster_path,
  ...(manual && { manual }),
})

// Exact title (+100) with a year at most one off (+25) is good enough to stop searching.
const CONFIDENT = 125

export async function findMatch(key: string, film: Film, signal?: AbortSignal): Promise<Match> {
  const attempts: SearchOptions[] = film.year
    ? [{ primaryReleaseYear: film.year }, { year: film.year }, { primaryReleaseYear: film.year - 1 }, { primaryReleaseYear: film.year + 1 }, {}]
    : [{}]

  let best: { movie: TmdbMovie; score: number } | null = null
  for (const options of attempts) {
    const candidate = pickBest(await searchMovies(key, film.name, options, signal), film.name, film.year)
    if (candidate && (!best || candidate.score > best.score)) best = candidate
    if (best && best.score >= CONFIDENT) break
  }
  return best ? toMatch(best.movie) : { status: 'notfound' }
}
