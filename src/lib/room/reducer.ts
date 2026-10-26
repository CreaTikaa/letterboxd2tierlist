import { currentMatch, pick, undo } from '../tournament'
import { defaultTiers } from '../tiers'
import { currentMatchKey, emptyRoomTournament, matchKey } from './groupTournament'
import type { Op, RoomState, RoomTournament, Showdown } from './types'

export const emptyShowdown = (): Showdown => ({ phase: 'idle', mode: 'classic', round: 0, filmIds: [], tiers: [], boards: {}, votes: {}, guesses: {} })

export function emptyRoomState(id: string, anchored = false): RoomState {
  return { id, anchored, version: 0, members: {}, board: defaultTiers(), showdown: emptyShowdown(), tournament: emptyRoomTournament() }
}

/** Fills in fields added after a room was saved (rooms are kept in browsers indefinitely). */
export function normalizeRoomState(state: RoomState): RoomState {
  return {
    ...emptyRoomState(state.id),
    ...state,
    // Copies saved before anchoring existed are real rooms.
    anchored: state.anchored ?? true,
    showdown: { ...emptyShowdown(), ...state.showdown },
    tournament: state.tournament ?? emptyRoomTournament(),
  }
}

function applyTournamentOp(tournament: RoomTournament, op: Op): RoomTournament {
  const { bracket } = tournament
  switch (op.t) {
    case 'tn-start':
      return { bracket: op.bracket, votes: {}, log: [] }
    case 'tn-vote':
      if (op.matchKey !== currentMatchKey(bracket)) return tournament
      return { ...tournament, votes: { ...tournament.votes, [op.memberId]: op.filmId } }
    case 'tn-resolve': {
      const current = bracket && currentMatch(bracket)
      if (!current || op.matchKey !== matchKey(current.round, current.match)) return tournament
      try {
        return {
          bracket: pick(bracket, op.winnerId),
          votes: {},
          log: [...tournament.log, { ...current, winnerId: op.winnerId, votes: tournament.votes }],
        }
      } catch {
        return tournament // winner isn't in this match
      }
    }
    case 'tn-undo': {
      const last = tournament.log.at(-1)
      if (!bracket || !last || matchKey(last.round, last.match) !== op.matchKey) return tournament
      return { bracket: undo(bracket), votes: {}, log: tournament.log.slice(0, -1) }
    }
    case 'tn-reset':
      return emptyRoomTournament()
    default:
      return tournament
  }
}

/** Applies an op without touching `version` (the host owns versioning). */
export function applyOp(state: RoomState, op: Op): RoomState {
  switch (op.t) {
    case 'member':
      return { ...state, members: { ...state.members, [op.member.id]: op.member } }
    case 'member-remove': {
      const { [op.memberId]: _removed, ...members } = state.members
      return { ...state, members }
    }
    case 'board':
      return { ...state, board: op.tiers }
    case 'sd-start':
      return {
        ...state,
        showdown: { phase: 'ranking', mode: op.mode, round: op.round, filmIds: op.filmIds, tiers: op.tiers, boards: {}, votes: {}, guesses: {} },
      }
    case 'sd-lock': {
      const { [op.memberId]: _old, ...boards } = state.showdown.boards
      return { ...state, showdown: { ...state.showdown, boards: op.tiers ? { ...boards, [op.memberId]: op.tiers } : boards } }
    }
    case 'sd-phase':
      return { ...state, showdown: { ...state.showdown, phase: op.phase } }
    case 'sd-vote':
      return { ...state, showdown: { ...state.showdown, votes: { ...state.showdown.votes, [op.memberId]: { best: op.best, worst: op.worst } } } }
    case 'sd-guess': {
      const { [op.ownerId]: _old, ...mine } = state.showdown.guesses[op.memberId] ?? {}
      const guesses = { ...state.showdown.guesses, [op.memberId]: op.guessId ? { ...mine, [op.ownerId]: op.guessId } : mine }
      return { ...state, showdown: { ...state.showdown, guesses } }
    }
    case 'tn-start':
    case 'tn-vote':
    case 'tn-resolve':
    case 'tn-undo':
    case 'tn-reset':
      return { ...state, tournament: applyTournamentOp(state.tournament, op) }
  }
}
