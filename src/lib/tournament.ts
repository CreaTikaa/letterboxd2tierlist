import { shuffle } from './random'
import type { Film, Tier } from './types'

/**
 * Single-elimination bracket. `seeds[0]` is seed #1. Rounds are played in order; byes (when the
 * film count isn't a power of two) go to the top seeds and are resolved when the bracket is created.
 */
export interface Tournament {
  id: string
  createdAt: string
  size: number
  seeds: Film[]
  /** First-round slots in bracket order: film ids, or null for a bye. */
  slots: (string | null)[]
  /** picks[round][match] = winner id, null while unplayed. */
  picks: (string | null)[][]
  /** Matches decided by the player, in order (byes excluded), for undo. */
  history: { round: number; match: number }[]
}

export type SelectionMode = 'top' | 'random'

export const MIN_ENTRANTS = 2
export const MAX_ENTRANTS = 256

export function nextPowerOfTwo(n: number): number {
  let size = 1
  while (size < n) size *= 2
  return size
}

/** Standard bracket order of seeds (1-based) so that seeds 1 and 2 can only meet in the final. */
export function seedPositions(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((seed) => [seed, n + 1 - seed])
  }
  return order
}

/**
 * Picks `count` films and orders them by seed: higher rating = better seed, ties broken randomly,
 * unrated last. "top" takes the best-rated films; "random" draws a random sample first.
 */
export function seedFilms(films: Film[], count: number, mode: SelectionMode, random: () => number = Math.random): Film[] {
  const byRating = (list: Film[]) => shuffle(list, random).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  const chosen = mode === 'top' ? byRating(films).slice(0, count) : shuffle(films, random).slice(0, count)
  return byRating(chosen)
}

export function roundCount(size: number): number {
  return Math.log2(size)
}

export type RoundKind = 'final' | 'semi' | 'quarter' | 'roundOf'

/** What a round is called: final, semi-finals, quarter-finals, or "round of N" (N films left). */
export function roundInfo(size: number, round: number): { kind: RoundKind; remaining: number } {
  const remaining = size / 2 ** round
  const kind: RoundKind = remaining === 2 ? 'final' : remaining === 4 ? 'semi' : remaining === 8 ? 'quarter' : 'roundOf'
  return { kind, remaining }
}

export function entrants(t: Tournament, round: number, match: number): [string | null, string | null] {
  const source = round === 0 ? t.slots : t.picks[round - 1]
  return [source[match * 2] ?? null, source[match * 2 + 1] ?? null]
}

export function createTournament(seeds: Film[], id = String(Date.now())): Tournament {
  if (seeds.length < MIN_ENTRANTS) throw new Error(`A tournament needs at least ${MIN_ENTRANTS} films.`)
  const size = nextPowerOfTwo(seeds.length)
  const slots = seedPositions(size).map((seed) => seeds[seed - 1]?.id ?? null)
  const picks = Array.from({ length: roundCount(size) }, (_, r) => Array<string | null>(size / 2 ** (r + 1)).fill(null))
  // Byes only exist in the first round, and top seeds never face each other there.
  picks[0] = picks[0].map((_, m) => {
    const [a, b] = [slots[m * 2], slots[m * 2 + 1]]
    return a && b ? null : (a ?? b)
  })
  return { id, createdAt: new Date().toISOString(), size, seeds, slots, picks, history: [] }
}

export function currentMatch(t: Tournament): { round: number; match: number } | null {
  for (let round = 0; round < t.picks.length; round++) {
    const match = t.picks[round].indexOf(null)
    if (match >= 0) return { round, match }
  }
  return null
}

export function pick(t: Tournament, winnerId: string): Tournament {
  const current = currentMatch(t)
  if (!current) return t
  if (!entrants(t, current.round, current.match).includes(winnerId)) throw new Error('That film is not in the current match.')
  const picks = t.picks.map((round) => [...round])
  picks[current.round][current.match] = winnerId
  return { ...t, picks, history: [...t.history, current] }
}

export function undo(t: Tournament): Tournament {
  const last = t.history.at(-1)
  if (!last) return t
  const picks = t.picks.map((round) => [...round])
  picks[last.round][last.match] = null
  return { ...t, picks, history: t.history.slice(0, -1) }
}

export function champion(t: Tournament): string | null {
  return t.picks.at(-1)?.[0] ?? null
}

/** Matches the player actually has to decide (byes excluded). */
export function playableMatchCount(t: Tournament): number {
  const byes = t.slots.filter((s) => s === null).length
  return t.size - 1 - byes
}

export interface Standing {
  filmId: string
  /** 1 = champion, 2 = runner-up, 3 = semi-finalist, 5 = quarter-finalist… */
  place: number
  seed: number
}

/** Final standings, best first. Films knocked out in the same round share a place. */
export function standings(t: Tournament): Standing[] {
  const seedOf = new Map(t.seeds.map((f, i) => [f.id, i + 1]))
  const result: Standing[] = []
  const winner = champion(t)
  if (winner) result.push({ filmId: winner, place: 1, seed: seedOf.get(winner)! })
  for (let round = t.picks.length - 1; round >= 0; round--) {
    const place = t.size / 2 ** (round + 1) + 1
    t.picks[round].forEach((winnerId, match) => {
      if (!winnerId) return
      const loser = entrants(t, round, match).find((id) => id && id !== winnerId)
      if (loser) result.push({ filmId: loser, place, seed: seedOf.get(loser)! })
    })
  }
  return result.sort((a, b) => a.place - b.place || a.seed - b.seed)
}

export interface Upset {
  round: number
  winnerId: string
  loserId: string
  /** Seed difference (positive = the lower seed won). */
  gap: number
}

export function upsets(t: Tournament): Upset[] {
  const seedOf = new Map(t.seeds.map((f, i) => [f.id, i + 1]))
  const result: Upset[] = []
  t.picks.forEach((round, r) =>
    round.forEach((winnerId, m) => {
      const loserId = entrants(t, r, m).find((id) => id && id !== winnerId)
      if (!winnerId || !loserId) return
      const gap = seedOf.get(winnerId)! - seedOf.get(loserId)!
      if (gap > 0) result.push({ round: r, winnerId, loserId, gap })
    }),
  )
  return result.sort((a, b) => b.gap - a.gap)
}

/** Range of finishing positions sharing `place`: 1 → [1, 1], 2 → [2, 2], 3 → [3, 4], 5 → [5, 8]… */
export function placeRange(place: number): [number, number] {
  return place <= 2 ? [place, place] : [place, place * 2 - 2]
}

export const BRACKET_SIZES = [8, 16, 32, 64, 128, 256]

/** Standard sizes that fit, plus "all N" when N isn't one of them. */
export function bracketSizeOptions(available: number): number[] {
  const sizes = BRACKET_SIZES.filter((n) => n <= available)
  const all = Math.min(available, MAX_ENTRANTS)
  if (all >= MIN_ENTRANTS && !sizes.includes(all)) sizes.push(all)
  return sizes
}

/** The requested size if offered, else the largest option up to 16. */
export function pickBracketSize(options: number[], requested: number): number {
  return options.includes(requested) ? requested : (options.filter((n) => n <= 16).at(-1) ?? options[0] ?? 0)
}

/**
 * Places the tournament's films on a tier board by how far they got: champion in the first tier,
 * runner-up in the second, semi-finalists in the third… and everyone else in the last tier.
 * Other films on the board keep their spots.
 */
export function standingsToTiers(t: Tournament, tiers: Tier[]): Tier[] {
  if (tiers.length === 0) return tiers
  const table = standings(t)
  const places = [...new Set(table.map((s) => s.place))].sort((a, b) => a - b)
  const inTournament = new Set(table.map((s) => s.filmId))
  const result = tiers.map((tier) => ({ ...tier, filmIds: tier.filmIds.filter((id) => !inTournament.has(id)) }))
  for (const { filmId, place } of table) result[Math.min(places.indexOf(place), tiers.length - 1)].filmIds.push(filmId)
  return result
}
