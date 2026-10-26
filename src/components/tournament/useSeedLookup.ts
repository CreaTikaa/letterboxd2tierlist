import { useMemo } from 'react'
import type { Tournament } from '../../lib/tournament'

/** film id → film and seed number (1-based). */
export function useSeedLookup(t: Tournament) {
  return useMemo(() => new Map(t.seeds.map((f, i) => [f.id, { film: f, seed: i + 1 }])), [t.seeds])
}
