const API = 'https://api.themoviedb.org/3'
const IMAGES = 'https://image.tmdb.org/t/p'

export interface TmdbMovie {
  id: number
  title: string
  original_title: string
  release_date?: string
  poster_path: string | null
  popularity?: number
}

export class TmdbError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'

export const posterUrl = (path: string, size: PosterSize = 'w185') => `${IMAGES}/${size}${path}`

/** v4 "API Read Access Tokens" are JWTs; anything else is treated as a v3 API key. */
const isBearerToken = (key: string) => key.startsWith('eyJ')

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  key: string,
  signal?: AbortSignal,
  attempt = 0,
): Promise<T> {
  const url = new URL(API + path)
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(name, String(value))
  }
  const headers: Record<string, string> = { accept: 'application/json' }
  if (isBearerToken(key)) headers.Authorization = `Bearer ${key}`
  else url.searchParams.set('api_key', key)

  const res = await fetch(url, { headers, signal })
  if (res.status === 429 && attempt < 5) {
    const retryAfter = Number(res.headers.get('retry-after')) || 1
    await sleep(retryAfter * 1000 * (attempt + 1))
    return tmdbFetch(path, params, key, signal, attempt + 1)
  }
  if (!res.ok) {
    throw new TmdbError(res.status === 401 ? 'Invalid TMDB API key' : `TMDB request failed (${res.status})`, res.status)
  }
  return res.json() as Promise<T>
}

export interface SearchOptions {
  year?: number
  primaryReleaseYear?: number
}

export async function searchMovies(key: string, query: string, options: SearchOptions = {}, signal?: AbortSignal) {
  const data = await tmdbFetch<{ results: TmdbMovie[] }>(
    '/search/movie',
    { query, include_adult: 'false', year: options.year, primary_release_year: options.primaryReleaseYear },
    key,
    signal,
  )
  return data.results
}

export const getMovie = (key: string, id: number, signal?: AbortSignal) =>
  tmdbFetch<TmdbMovie>(`/movie/${id}`, {}, key, signal)

export async function validateKey(key: string): Promise<void> {
  await tmdbFetch('/configuration', {}, key)
}
