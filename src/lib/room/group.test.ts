import { describe, expect, it } from 'vitest'
import { defaultTiers } from '../tiers'
import type { Film, Tier } from '../types'
import { groupFilms, pickShowdownFilms, showdownResults } from './group'
import { applyOp, emptyRoomState, emptyShowdown } from './reducer'
import type { Member } from './types'

const film = (id: string, rating: number | null, name = id): Film => ({ id, name, year: 2000, uri: id, rating, watchedDate: null })
const member = (id: string, films: Film[]): Member => ({ id, name: id, films })

describe('groupFilms', () => {
  const members = [member('ann', [film('x', 5), film('y', null), film('z', 1)]), member('bob', [film('x', 4), film('y', 3)])]

  it('merges films and averages ratings over members who rated', () => {
    const byId = Object.fromEntries(groupFilms(members).map((f) => [f.id, f]))
    expect(byId['x']).toMatchObject({ watchers: ['ann', 'bob'], average: 4.5, rating: 4.5, ratings: { ann: 5, bob: 4 } })
    expect(byId['y']).toMatchObject({ watchers: ['ann', 'bob'], average: 3, rating: 3 })
    expect(byId['z']).toMatchObject({ watchers: ['ann'], average: 1 })
  })

  it('rounds the average to the nearest half star for filtering', () => {
    const [x] = groupFilms([member('a', [film('x', 4)]), member('b', [film('x', 3.5)]), member('c', [film('x', 3.5)])])
    expect(x.average).toBeCloseTo(3.667, 2)
    expect(x.rating).toBe(3.5)
  })

  it('merges by title and year when ids differ', () => {
    const films = groupFilms([member('a', [film('id-1', 2, 'Heat')]), member('b', [film('id-2', 4, 'Heat')])])
    expect(films).toHaveLength(1)
    expect(films[0].average).toBe(3)
  })
})

describe('pickShowdownFilms', () => {
  const films = groupFilms([member('a', [film('both-hi', 5), film('both-lo', 1), film('solo', 5)]), member('b', [film('both-hi', 4), film('both-lo', 2)])])

  it('prefers films seen by more people, then the best average', () => {
    expect(pickShowdownFilms(films, { minWatchers: 1, count: 3, mode: 'popular' })).toEqual(['both-hi', 'both-lo', 'solo'])
    expect(pickShowdownFilms(films, { minWatchers: 2, count: 10, mode: 'popular' })).toEqual(['both-hi', 'both-lo'])
  })

  it('can draw a random sample', () => {
    const picked = pickShowdownFilms(films, { minWatchers: 1, count: 2, mode: 'random' })
    expect(picked).toHaveLength(2)
    expect(new Set(picked).size).toBe(2)
  })
})

describe('showdownResults', () => {
  const tiersWith = (placement: Record<string, number>): Tier[] => {
    const tiers = defaultTiers()
    for (const [filmId, index] of Object.entries(placement)) tiers[index].filmIds.push(filmId)
    return tiers
  }

  it('tallies votes and finds controversial and unanimous films', () => {
    const showdown = {
      ...emptyShowdown(),
      filmIds: ['x', 'y'],
      boards: { a: tiersWith({ x: 0, y: 2 }), b: tiersWith({ x: 5, y: 2 }), c: tiersWith({ x: 1, y: 2 }) },
      votes: { a: { best: 'b', worst: 'c' }, b: { best: 'c', worst: 'a' }, c: { best: 'b', worst: 'a' } },
    }
    const results = showdownResults(showdown)
    expect(results.best[0]).toEqual({ memberId: 'b', votes: 2 })
    expect(results.worst[0]).toEqual({ memberId: 'a', votes: 2 })
    expect(results.controversial).toEqual([{ filmId: 'x', spread: 5 }])
    expect(results.unanimous).toEqual([{ filmId: 'y', tierIndex: 2 }])
  })
})

describe('applyOp', () => {
  it('starts a showdown with a clean slate and handles lock/unlock and votes', () => {
    let state = emptyRoomState('r')
    state = applyOp(state, { t: 'sd-start', round: 1, filmIds: ['x'], tiers: defaultTiers() })
    expect(state.showdown.phase).toBe('ranking')
    state = applyOp(state, { t: 'sd-lock', memberId: 'a', tiers: defaultTiers() })
    expect(Object.keys(state.showdown.boards)).toEqual(['a'])
    state = applyOp(state, { t: 'sd-lock', memberId: 'a', tiers: null })
    expect(state.showdown.boards).toEqual({})
    state = applyOp(state, { t: 'sd-vote', memberId: 'a', best: 'b', worst: null })
    state = applyOp(state, { t: 'sd-start', round: 2, filmIds: [], tiers: [] })
    expect(state.showdown.votes).toEqual({})
  })

  it('adds and removes members', () => {
    let state = applyOp(emptyRoomState('r'), { t: 'member', member: member('a', []) })
    expect(state.members['a']).toBeDefined()
    state = applyOp(state, { t: 'member-remove', memberId: 'a' })
    expect(state.members).toEqual({})
  })
})
