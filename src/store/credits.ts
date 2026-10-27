import { runPool } from '../lib/pool'
import { getCredits } from '../lib/tmdb/client'
import type { Credits, Film } from '../lib/types'
import { useStore } from './useStore'

let running = false

/** TMDB ids of the given films that are matched but have no cast & crew cached yet. */
export function missingCredits(films: Film[]): number[] {
  const { matches, credits } = useStore.getState()
  const ids = new Set<number>()
  for (const film of films) {
    const match = matches[film.id]
    if (match?.status === 'matched' && match.tmdbId && !credits[match.tmdbId]) ids.add(match.tmdbId)
  }
  return [...ids]
}

/** Fetches directors and main cast for the given films (only when someone uses the people filter). */
export async function loadCredits(films: Film[]) {
  const { tmdbKey, setCredits, setCreditsProgress } = useStore.getState()
  if (!tmdbKey || running) return
  const pending = missingCredits(films)
  if (pending.length === 0) return
  running = true
  let done = 0
  let buffer: Record<number, Credits> = {}
  const flush = () => {
    if (Object.keys(buffer).length) setCredits(buffer)
    buffer = {}
    setCreditsProgress({ done, total: pending.length })
  }
  const timer = setInterval(flush, 400)
  setCreditsProgress({ done: 0, total: pending.length })
  try {
    await runPool(pending, 6, async (tmdbId) => {
      try {
        buffer[tmdbId] = await getCredits(tmdbKey, tmdbId)
      } catch {
        // Skipped; the next use of the filter retries it.
      }
      done++
    })
  } finally {
    clearInterval(timer)
    flush()
    setCreditsProgress(null)
    running = false
  }
}
