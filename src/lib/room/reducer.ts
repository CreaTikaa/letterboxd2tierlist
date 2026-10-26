import { defaultTiers } from '../tiers'
import type { Op, RoomState, Showdown } from './types'

export const emptyShowdown = (): Showdown => ({ phase: 'idle', round: 0, filmIds: [], tiers: [], boards: {}, votes: {} })

export function emptyRoomState(id: string): RoomState {
  return { id, version: 0, members: {}, board: defaultTiers(), showdown: emptyShowdown() }
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
        showdown: { phase: 'ranking', round: op.round, filmIds: op.filmIds, tiers: op.tiers, boards: {}, votes: {} },
      }
    case 'sd-lock': {
      const { [op.memberId]: _old, ...boards } = state.showdown.boards
      return { ...state, showdown: { ...state.showdown, boards: op.tiers ? { ...boards, [op.memberId]: op.tiers } : boards } }
    }
    case 'sd-phase':
      return { ...state, showdown: { ...state.showdown, phase: op.phase } }
    case 'sd-vote':
      return { ...state, showdown: { ...state.showdown, votes: { ...state.showdown.votes, [op.memberId]: { best: op.best, worst: op.worst } } } }
  }
}
