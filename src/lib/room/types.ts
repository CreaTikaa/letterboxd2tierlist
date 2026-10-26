import type { Tournament } from '../tournament'
import type { Film, Tier } from '../types'

/** A person in the room who has shared their Letterboxd films. */
export interface Member {
  id: string
  name: string
  films: Film[]
}

export type ShowdownPhase = 'idle' | 'ranking' | 'reveal' | 'results'

/**
 * "Showdown": everyone ranks the same films on their own board, boards are revealed together,
 * then everyone votes for the best and worst list.
 */
export interface Showdown {
  phase: ShowdownPhase
  /** Increments with every new showdown so private drafts from older rounds are ignored. */
  round: number
  filmIds: string[]
  /** Empty tiers everyone ranks into. */
  tiers: Tier[]
  /** Locked-in boards by member id (kept hidden in the UI until the reveal). */
  boards: Record<string, Tier[]>
  votes: Record<string, { best: string | null; worst: string | null }>
}

/** One record per decided match, for showing vote splits. */
export interface MatchRecord {
  round: number
  match: number
  winnerId: string
  /** memberId → filmId */
  votes: Record<string, string>
}

/**
 * Group tournament: one shared bracket, everyone votes on each matchup. A match is decided when
 * everyone online has voted (or the host closes the vote); majority wins, ties go to the better seed.
 */
export interface RoomTournament {
  /** Seeds carry the median group rating in `rating`. */
  bracket: Tournament | null
  /** Votes for the current match: memberId → filmId. */
  votes: Record<string, string>
  log: MatchRecord[]
}

export interface RoomState {
  id: string
  /** Bumped by the host for every applied op; used to order ops and pick the freshest copy. */
  version: number
  members: Record<string, Member>
  board: Tier[]
  showdown: Showdown
  tournament: RoomTournament
}

/** State changes. All ops are "set"-style, so applying one twice is harmless. */
export type Op =
  | { t: 'member'; member: Member }
  | { t: 'member-remove'; memberId: string }
  | { t: 'board'; tiers: Tier[] }
  | { t: 'sd-start'; round: number; filmIds: string[]; tiers: Tier[] }
  | { t: 'sd-lock'; memberId: string; tiers: Tier[] | null }
  | { t: 'sd-phase'; phase: ShowdownPhase }
  | { t: 'sd-vote'; memberId: string; best: string | null; worst: string | null }
  | { t: 'tn-start'; bracket: Tournament }
  /** `matchKey` ties the vote to one match so late votes can't leak into the next one. */
  | { t: 'tn-vote'; memberId: string; matchKey: string; filmId: string }
  | { t: 'tn-resolve'; matchKey: string; winnerId: string }
  /** Undoes the decided match `matchKey`, only if it's still the most recent one. */
  | { t: 'tn-undo'; matchKey: string }
  | { t: 'tn-reset' }
