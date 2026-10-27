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

export function addTier(tiers: Tier[], label: string): Tier[] {
  return [...tiers, { id: newTierId(), label, color: TIER_COLORS[tiers.length % TIER_COLORS.length], filmIds: [] }]
}

export function updateTier(tiers: Tier[], id: string, changes: Partial<Omit<Tier, 'id'>>): Tier[] {
  return tiers.map((t) => (t.id === id ? { ...t, ...changes } : t))
}

export function removeTier(tiers: Tier[], id: string): Tier[] {
  return tiers.filter((t) => t.id !== id)
}

export function moveTier(tiers: Tier[], id: string, offset: -1 | 1): Tier[] {
  const from = tiers.findIndex((t) => t.id === id)
  const to = from + offset
  if (from < 0 || to < 0 || to >= tiers.length) return tiers
  const result = [...tiers]
  ;[result[from], result[to]] = [result[to], result[from]]
  return result
}

export const clearTiers = (tiers: Tier[]): Tier[] => tiers.map((t) => ({ ...t, filmIds: [] }))

/** Same tiers (ids, labels, colours, films and order)? Used to tell our own changes from others'. */
export function tiersEqual(a: Tier[], b: Tier[]): boolean {
  return (
    a === b ||
    (a.length === b.length &&
      a.every((tier, i) => {
        const other = b[i]
        return tier.id === other.id && tier.label === other.label && tier.color === other.color && tier.filmIds.join('\n') === other.filmIds.join('\n')
      }))
  )
}

/** Moves a film to the end of a tier (or off the board when `tierId` is null). */
export function moveFilmTo(tiers: Tier[], filmId: string, tierId: string | null): Tier[] {
  return tiers.map((tier) => {
    const without = tier.filmIds.filter((id) => id !== filmId)
    return { ...tier, filmIds: tier.id === tierId ? [...without, filmId] : without }
  })
}
