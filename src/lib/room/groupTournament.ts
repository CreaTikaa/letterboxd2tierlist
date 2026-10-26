import { currentMatch, entrants, seedFilms, type SelectionMode, type Tournament } from '../tournament'
import type { Film } from '../types'
import type { GroupFilm } from './group'
import type { Op, RoomState, RoomTournament } from './types'

export const emptyRoomTournament = (): RoomTournament => ({ bracket: null, votes: {}, log: [] })

export const matchKey = (round: number, match: number) => `${round}-${match}`

export function currentMatchKey(bracket: Tournament | null): string | null {
  const current = bracket && currentMatch(bracket)
  return current ? matchKey(current.round, current.match) : null
}

export interface GroupSeedOptions {
  /** Only films seen by at least this many members (use the member count for "everyone"). */
  minWatchers: number
  /** Minimum median rating; 0 also lets in films nobody rated (they're seeded last). */
  minMedian: number
  count: number
  mode: SelectionMode
}

/** Films that qualify for a group tournament, with `rating` set to the median group rating. */
export function eligibleGroupFilms(films: GroupFilm[], { minWatchers, minMedian }: Pick<GroupSeedOptions, 'minWatchers' | 'minMedian'>): Film[] {
  return films
    .filter((f) => f.watchers.length >= minWatchers && (f.median == null ? minMedian === 0 : f.median >= minMedian))
    .map(({ id, name, year, uri, median }) => ({ id, name, year, uri, rating: median, watchedDate: null }))
}

export function groupSeeds(films: GroupFilm[], options: GroupSeedOptions, random: () => number = Math.random): Film[] {
  return seedFilms(eligibleGroupFilms(films, options), options.count, options.mode, random)
}

export function voteCounts(votes: Record<string, string>, filmIds: (string | null)[]): Map<string, number> {
  const counts = new Map(filmIds.filter((id): id is string => Boolean(id)).map((id) => [id, 0]))
  for (const filmId of Object.values(votes)) if (counts.has(filmId)) counts.set(filmId, counts.get(filmId)! + 1)
  return counts
}

/** Majority of the votes for the current match; a tie (or no votes) goes to the better seed. */
export function decideWinner(bracket: Tournament, votes: Record<string, string>): string | null {
  const current = currentMatch(bracket)
  if (!current) return null
  const [a, b] = entrants(bracket, current.round, current.match)
  if (!a || !b) return a ?? b
  const counts = voteCounts(votes, [a, b])
  if (counts.get(a)! !== counts.get(b)!) return counts.get(a)! > counts.get(b)! ? a : b
  const seedOf = (id: string) => bracket.seeds.findIndex((f) => f.id === id)
  return seedOf(a) <= seedOf(b) ? a : b
}

/** The resolve op the host should apply once everyone online has voted, if that's the case. */
export function autoResolve(state: RoomState, onlineMemberIds: string[]): Op | null {
  const { bracket, votes } = state.tournament
  const key = currentMatchKey(bracket)
  if (!bracket || !key || onlineMemberIds.length === 0) return null
  if (!onlineMemberIds.every((id) => votes[id])) return null
  const winnerId = decideWinner(bracket, votes)
  return winnerId ? { t: 'tn-resolve', matchKey: key, winnerId } : null
}
