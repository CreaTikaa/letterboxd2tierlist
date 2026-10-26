import { sortFilms } from './filter'
import { RATING_VALUES, ratingKey } from './ratings'
import type { Film, RatingMap, Tier } from './types'

export const newTierId = () => `tier-${Math.random().toString(36).slice(2, 10)}`

// Classic TierMaker palette.
export const TIER_COLORS = ['#ff7f7f', '#ffbf7f', '#ffdf7f', '#ffff7f', '#bfff7f', '#7fff7f', '#7fffff', '#7fbfff', '#bf7fff']

export function defaultTiers(): Tier[] {
  return ['S', 'A', 'B', 'C', 'D', 'F'].map((label, i) => ({
    id: `tier-${label.toLowerCase()}`,
    label,
    color: TIER_COLORS[i],
    filmIds: [],
  }))
}

export function defaultRatingMap(tiers: Tier[]): RatingMap {
  const [s, a, b, c, d, f] = tiers.map((t) => t.id)
  const targets = [s, a, a, b, b, c, c, d, d, f]
  return Object.fromEntries(RATING_VALUES.map((r, i) => [ratingKey(r), targets[i] ?? '']))
}

/**
 * Places every given film in the tier its rating maps to (best-rated first), and takes
 * unrated/unmapped ones out of the board. Films not in `films` keep their placement.
 */
export function autoFill(tiers: Tier[], films: Film[], map: RatingMap): Tier[] {
  const affected = new Set(films.map((f) => f.id))
  const placed = new Map<string, string[]>(tiers.map((t) => [t.id, []]))
  for (const film of sortFilms(films, 'rating')) {
    if (film.rating == null) continue
    placed.get(map[ratingKey(film.rating)] ?? '')?.push(film.id)
  }
  return tiers.map((tier) => ({
    ...tier,
    filmIds: [...tier.filmIds.filter((id) => !affected.has(id)), ...placed.get(tier.id)!],
  }))
}

export function placedIds(tiers: Tier[]): Set<string> {
  return new Set(tiers.flatMap((t) => t.filmIds))
}
