import { ratingKey } from './ratings'
import type { Film, RatingMap, Tier } from './types'

/**
 * "Rank everything": a complete order built from "which do you prefer?" picks, by binary insertion
 * (each new film is compared against the middle of what's already ranked). Only the answers are
 * stored; the state is replayed from them, which makes undo exact and the saved data tiny.
 */
export type RankMode = 'ties' | 'full'

export interface RankSession {
  id: string
  createdAt: string
  mode: RankMode
  films: Film[]
  /** Groups sorted independently, best group first ("ties": one group per star rating). */
  groups: string[][]
  /** true = the film being placed was preferred over the one it was compared with. */
  answers: boolean[]
}

export interface Comparison {
  /** The film being placed. */
  candidate: string
  /** The already-ranked film it's compared with. */
  opponent: string
}

export interface RankState {
  /** Ranked so far, per group, best first. */
  sorted: string[][]
  /** Next question, or null when the ranking is complete. */
  next: Comparison | null
}

/** Picks needed to insert one film into a ranked list of `size` films, in the worst case. */
const insertCost = (size: number) => Math.ceil(Math.log2(size + 1))

export function groupsFor(films: Film[], mode: RankMode): string[][] {
  // Best-rated first; unrated last.
  const ordered = [...films].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  if (mode === 'full') return ordered.length ? [ordered.map((f) => f.id)] : []
  const groups = new Map<number | null, string[]>()
  for (const film of ordered) groups.set(film.rating, [...(groups.get(film.rating) ?? []), film.id])
  return [...groups.values()]
}

/** Worst-case number of picks for these groups. */
export function estimatePicks(groups: string[][]): number {
  let total = 0
  for (const group of groups) for (let i = 1; i < group.length; i++) total += insertCost(i)
  return total
}

export function createRanking(films: Film[], mode: RankMode, id = String(Date.now())): RankSession {
  return { id, createdAt: new Date().toISOString(), mode, films, groups: groupsFor(films, mode), answers: [] }
}

export function replay(session: Pick<RankSession, 'groups' | 'answers'>): RankState {
  const sorted: string[][] = []
  let k = 0
  for (const group of session.groups) {
    const ranked: string[] = []
    sorted.push(ranked)
    for (const candidate of group) {
      let lo = 0
      let hi = ranked.length
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (k >= session.answers.length) return { sorted, next: { candidate, opponent: ranked[mid] } }
        if (session.answers[k++]) hi = mid
        else lo = mid + 1
      }
      ranked.splice(lo, 0, candidate)
    }
  }
  return { sorted, next: null }
}

export const answer = (session: RankSession, preferCandidate: boolean): RankSession => ({ ...session, answers: [...session.answers, preferCandidate] })

export const undoAnswer = (session: RankSession): RankSession => ({ ...session, answers: session.answers.slice(0, -1) })

/** The final (or current partial) order, best first. */
export const rankingOrder = (state: RankState): string[] => state.sorted.flat()

/**
 * Places ranked films on a tier board. "ties": tiers come from ratings (as auto-fill does) and the
 * ranking orders films inside each tier. "full": the ranking is cut into equal slices, top slice in
 * the first tier. Films outside the ranking keep their spots.
 */
export function rankingToTiers(order: string[], films: Film[], tiers: Tier[], mode: RankMode, ratingMap: RatingMap): Tier[] {
  if (tiers.length === 0) return tiers
  const ranked = new Set(order)
  const result = tiers.map((tier) => ({ ...tier, filmIds: tier.filmIds.filter((id) => !ranked.has(id)) }))
  const byId = new Map(films.map((f) => [f.id, f]))
  order.forEach((id, index) => {
    let tierIndex: number
    if (mode === 'ties') {
      const rating = byId.get(id)?.rating
      tierIndex = rating == null ? -1 : result.findIndex((t) => t.id === ratingMap[ratingKey(rating)])
    } else {
      tierIndex = Math.min(tiers.length - 1, Math.floor((index * tiers.length) / order.length))
    }
    if (tierIndex >= 0) result[tierIndex].filmIds.push(id)
  })
  return result
}
