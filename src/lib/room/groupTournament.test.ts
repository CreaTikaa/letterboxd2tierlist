import { describe, expect, it } from 'vitest'
import { champion, createTournament, currentMatch, entrants } from '../tournament'
import type { Film } from '../types'
import { groupFilms, median } from './group'
import { autoResolve, currentMatchKey, decideWinner, eligibleGroupFilms, groupSeeds } from './groupTournament'
import { applyOp, emptyRoomState, normalizeRoomState } from './reducer'
import type { Member, RoomState } from './types'

const film = (id: string, rating: number | null): Film => ({ id, name: id, year: 2000, uri: id, rating, watchedDate: null })
const member = (id: string, films: Film[]): Member => ({ id, name: id, films })

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([1, 5, 3])).toBe(3)
    expect(median([4, 1, 5, 4.5])).toBe(4.25)
    expect(median([])).toBeNull()
  })
})

describe('group seeding', () => {
  const films = groupFilms([
    member('a', [film('all-high', 5), film('all-mid', 3), film('two-only', 5), film('unrated', null)]),
    member('b', [film('all-high', 4), film('all-mid', 3), film('two-only', 4.5), film('unrated', null)]),
    member('c', [film('all-high', 4.5), film('all-mid', 2)]),
  ])

  it('can keep only films everyone has seen, seeded by median', () => {
    const seeds = groupSeeds(films, { minWatchers: 3, minMedian: 0, count: 8, mode: 'top' })
    expect(seeds.map((f) => [f.id, f.rating])).toEqual([
      ['all-high', 4.5],
      ['all-mid', 3],
    ])
  })

  it('uses the median, not the average (one outlier does not move it)', () => {
    const [x] = groupFilms([member('a', [film('x', 5)]), member('b', [film('x', 5)]), member('c', [film('x', 0.5)])])
    expect(x.median).toBe(5)
    expect(x.average).toBeCloseTo(3.5)
  })

  it('filters by minimum median and leaves unrated films out unless the minimum is 0', () => {
    const ids = (minMedian: number) => eligibleGroupFilms(films, { minWatchers: 2, minMedian }).map((f) => f.id)
    expect(ids(0)).toContain('unrated')
    expect(ids(4)).toEqual(['all-high', 'two-only'])
  })
})

function playingState(): RoomState {
  const seeds = ['s1', 's2', 's3', 's4'].map((id, i) => film(id, 5 - i))
  return applyOp(emptyRoomState('r'), { t: 'tn-start', bracket: createTournament(seeds) })
}

describe('group tournament voting', () => {
  it('decides by majority, ties going to the better seed', () => {
    const { bracket } = playingState().tournament
    // First match is #1 vs #4.
    expect(entrants(bracket!, 0, 0)).toEqual(['s1', 's4'])
    expect(decideWinner(bracket!, { a: 's4', b: 's4', c: 's1' })).toBe('s4')
    expect(decideWinner(bracket!, { a: 's4', b: 's1' })).toBe('s1')
    expect(decideWinner(bracket!, {})).toBe('s1')
  })

  it('resolves only once everyone online has voted', () => {
    let state = playingState()
    const key = currentMatchKey(state.tournament.bracket)!
    state = applyOp(state, { t: 'tn-vote', memberId: 'a', matchKey: key, filmId: 's4' })
    expect(autoResolve(state, ['a', 'b'])).toBeNull()
    state = applyOp(state, { t: 'tn-vote', memberId: 'b', matchKey: key, filmId: 's4' })
    const op = autoResolve(state, ['a', 'b'])
    expect(op).toEqual({ t: 'tn-resolve', matchKey: key, winnerId: 's4' })

    state = applyOp(state, op!)
    expect(state.tournament.votes).toEqual({})
    expect(state.tournament.log).toEqual([{ round: 0, match: 0, winnerId: 's4', votes: { a: 's4', b: 's4' } }])
    expect(currentMatch(state.tournament.bracket!)).toEqual({ round: 0, match: 1 })
  })

  it('ignores votes and resolves meant for another match (late or duplicated messages)', () => {
    let state = playingState()
    const key = currentMatchKey(state.tournament.bracket)!
    const resolve = { t: 'tn-resolve', matchKey: key, winnerId: 's1' } as const
    state = applyOp(applyOp(state, resolve), resolve)
    expect(state.tournament.log).toHaveLength(1)
    state = applyOp(state, { t: 'tn-vote', memberId: 'a', matchKey: key, filmId: 's1' })
    expect(state.tournament.votes).toEqual({})
  })

  it('undoes only the match it names, once', () => {
    let state = playingState()
    const key = currentMatchKey(state.tournament.bracket)!
    state = applyOp(state, { t: 'tn-resolve', matchKey: key, winnerId: 's1' })
    const undoOp = { t: 'tn-undo', matchKey: key } as const
    state = applyOp(applyOp(state, undoOp), undoOp)
    expect(state.tournament.log).toEqual([])
    expect(currentMatchKey(state.tournament.bracket)).toBe(key)
  })

  it('plays to a champion and resets', () => {
    let state = playingState()
    while (currentMatchKey(state.tournament.bracket)) {
      const op = autoResolve(applyOp(state, { t: 'tn-vote', memberId: 'a', matchKey: currentMatchKey(state.tournament.bracket)!, filmId: 's2' }), ['b'])
      // 'b' is the only one online and hasn't voted: nothing to resolve yet.
      expect(op).toBeNull()
      const winner = decideWinner(state.tournament.bracket!, {})!
      state = applyOp(state, { t: 'tn-resolve', matchKey: currentMatchKey(state.tournament.bracket)!, winnerId: winner })
    }
    expect(champion(state.tournament.bracket!)).toBe('s1')
    state = applyOp(state, { t: 'tn-reset' })
    expect(state.tournament.bracket).toBeNull()
  })

  it('fills in the tournament for rooms saved before it existed', () => {
    const { tournament: _t, ...old } = emptyRoomState('r')
    expect(normalizeRoomState(old as RoomState).tournament).toEqual({ bracket: null, votes: {}, log: [] })
  })
})
