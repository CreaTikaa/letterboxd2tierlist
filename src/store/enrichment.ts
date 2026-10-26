import { runPool } from '../lib/pool'
import { TmdbError } from '../lib/tmdb/client'
import { findMatch } from '../lib/tmdb/match'
import type { Film, Match } from '../lib/types'
import { useStore } from './useStore'

let controller: AbortController | null = null
/** Films requested while a run was in progress; picked up by the next pass. */
let queued = new Map<string, Film>()

/**
 * Looks up a TMDB match for every given film (default: the imported library) that doesn't have one yet.
 * Calls made while a lookup is running are queued and handled in the same run.
 */
export async function startEnrichment(films: Film[] = useStore.getState().films) {
  for (const film of films) queued.set(film.id, film)
  const { tmdbKey } = useStore.getState()
  if (!tmdbKey || controller) return

  const ctrl = new AbortController()
  controller = ctrl
  let fatal: string | null = null
  let failed = 0
  let done = 0
  let total = 0

  while (queued.size && !ctrl.signal.aborted) {
    const { matches, setMatches, setEnrichment } = useStore.getState()
    const pending = [...queued.values()].filter((f) => !matches[f.id])
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
  }

  if (ctrl.signal.aborted) queued = new Map()
  useStore.getState().setEnrichment({
    running: false,
    error: fatal ?? (failed ? `${failed} film${failed > 1 ? 's' : ''} couldn't be looked up (network error). Retry to try again.` : null),
  })
  controller = null
}

export function stopEnrichment() {
  controller?.abort()
}
