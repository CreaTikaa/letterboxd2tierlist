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

export interface RoomState {
  id: string
  /** Bumped by the host for every applied op; used to order ops and pick the freshest copy. */
  version: number
  members: Record<string, Member>
  board: Tier[]
  showdown: Showdown
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
