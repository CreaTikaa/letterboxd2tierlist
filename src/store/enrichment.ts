import { runPool } from '../lib/pool'
import { TmdbError, getMovie } from '../lib/tmdb/client'
import { findMatch } from '../lib/tmdb/match'
import type { Film, Match } from '../lib/types'
import { useStore, type EnrichmentError } from './useStore'

let controller: AbortController | null = null
/** Films requested while a run was in progress; picked up by the next pass. */
let queued = new Map<string, Film>()

/** Matches cached before genres were stored need one details request to fill them in. */
const needsGenres = (match: Match | undefined) => match?.status === 'matched' && match.genreIds === undefined

async function lookUp(key: string, film: Film, existing: Match | undefined, signal: AbortSignal): Promise<Match> {
  if (existing?.status === 'matched' && needsGenres(existing)) {
    const details = await getMovie(key, existing.tmdbId, signal)
    return { ...existing, genreIds: details.genres?.map((g) => g.id) ?? [] }
  }
  return findMatch(key, film, signal)
}

/**
 * Looks up a TMDB match for every given film (default: the imported library) that doesn't have one yet,
 * and backfills genres for older matches.
 * Calls made while a lookup is running are queued and handled in the same run.
 */
export async function startEnrichment(films: Film[] = useStore.getState().films) {
  for (const film of films) queued.set(film.id, film)
  const { tmdbKey } = useStore.getState()
  if (!tmdbKey || controller) return

  const ctrl = new AbortController()
  controller = ctrl
  let fatal: EnrichmentError | null = null
  let failed = 0
  let done = 0
  let total = 0

  while (queued.size && !ctrl.signal.aborted) {
    const { matches, setMatches, setEnrichment } = useStore.getState()
    const pending = [...queued.values()].filter((f) => !matches[f.id] || needsGenres(matches[f.id]))
    queued = new Map()
    if (pending.length === 0) break
    total += pending.length
    setEnrichment({ running: true, done, total, error: null })

    // Flush results in batches so a 1,000-film library doesn't trigger 1,000 re-renders.
    let buffer: Record<string, Match> = {}
    const flush = () => {
      if (Object.keys(buffer).length) setMatches(buffer)
      buffer = {}
      setEnrichment({ done, total })
    }
    const timer = setInterval(flush, 300)

    // TMDB allows roughly 50 requests/second; a few lanes stays well under that.
    await runPool(
      pending,
      6,
      async (film) => {
        try {
          buffer[film.id] = await lookUp(tmdbKey, film, matches[film.id], ctrl.signal)
        } catch (error) {
          if (ctrl.signal.aborted) return
          if (error instanceof TmdbError && error.status === 401) {
            fatal = { code: 'invalidKey' }
            ctrl.abort()
            return
          }
          // Left unmatched, so the next run retries it.
          failed++
        }
        done++
      },
      ctrl.signal,
    )
    clearInterval(timer)
    flush()
  }

  if (ctrl.signal.aborted) queued = new Map()
  useStore.getState().setEnrichment({
    running: false,
    error: fatal ?? (failed ? { code: 'failed', count: failed } : null),
  })
  controller = null
}

export function stopEnrichment() {
  controller?.abort()
}
