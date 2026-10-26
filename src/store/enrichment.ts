import { runPool } from '../lib/pool'
import { TmdbError } from '../lib/tmdb/client'
import { findMatch } from '../lib/tmdb/match'
import type { Match } from '../lib/types'
import { useStore } from './useStore'

let controller: AbortController | null = null

/** Looks up a TMDB match for every film that doesn't have one yet. */
export async function startEnrichment() {
  const { films, matches, tmdbKey, setMatches, setEnrichment } = useStore.getState()
  if (!tmdbKey || controller) return
  const pending = films.filter((f) => !matches[f.id])
  if (pending.length === 0) return

  const ctrl = new AbortController()
  controller = ctrl
  setEnrichment({ running: true, done: 0, total: pending.length, error: null })

  // Flush results in batches so a 1,000-film library doesn't trigger 1,000 re-renders.
  let buffer: Record<string, Match> = {}
  let done = 0
  let failed = 0
  let fatal: string | null = null
  const flush = () => {
    if (Object.keys(buffer).length) setMatches(buffer)
    buffer = {}
    setEnrichment({ done })
  }
  const timer = setInterval(flush, 300)

  // TMDB allows roughly 50 requests/second; a few lanes stays well under that.
  await runPool(
    pending,
    6,
    async (film) => {
      try {
        buffer[film.id] = await findMatch(tmdbKey, film, ctrl.signal)
      } catch (error) {
        if (ctrl.signal.aborted) return
        if (error instanceof TmdbError && error.status === 401) {
          fatal = error.message
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
  setEnrichment({
    running: false,
    error: fatal ?? (failed ? `${failed} film${failed > 1 ? 's' : ''} couldn't be looked up (network error). Retry to try again.` : null),
  })
  controller = null
}

export function stopEnrichment() {
  controller?.abort()
}
