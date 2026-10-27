import { describe, expect, it } from 'vitest'
import { answer, createRanking, estimatePicks, groupsFor, rankingOrder, rankingToTiers, replay, undoAnswer, type RankSession } from './rank'
import { defaultRatingMap, defaultTiers } from './tiers'
import type { Film } from './types'

const film = (id: string, rating: number | null): Film => ({ id, name: id, year: 2000, uri: '', rating, watchedDate: null })

/** Answers every question by a hidden "true" preference order. */
function playOut(session: RankSession, truth: string[]) {
  let s = session
  let state = replay(s)
  let picks = 0
  while (state.next) {
    const { candidate, opponent } = state.next
    s = answer(s, truth.indexOf(candidate) < truth.indexOf(opponent))
    state = replay(s)
    picks++
  }
  return { session: s, order: rankingOrder(state), picks }
}

describe('rank everything', () => {
  const films = [film('a', 4), film('b', 5), film('c', 4), film('d', 4), film('e', null), film('f', 5)]

  it('groups by rating in "ties" mode (unrated last) and in one group in "full" mode', () => {
    expect(groupsFor(films, 'ties').map((g) => g.length)).toEqual([2, 3, 1])
    expect(groupsFor(films, 'full')).toHaveLength(1)
  })

  it('finds the true order of every group with few picks', () => {
    const truth = ['f', 'b', 'd', 'a', 'c', 'e']
    const { order, picks } = playOut(createRanking(films, 'ties'), truth)
    expect(order).toEqual(truth)
    expect(picks).toBeLessThanOrEqual(estimatePicks(groupsFor(films, 'ties')))
  })

  it('can go against ratings in "full" mode', () => {
    const truth = ['e', 'a', 'f', 'b', 'c', 'd']
    expect(playOut(createRanking(films, 'full'), truth).order).toEqual(truth)
  })

  it('sorts 50 films in at most ~n log n picks', () => {
    const many = Array.from({ length: 50 }, (_, i) => film(`m${i}`, 3))
    const truth = [...many.map((f) => f.id)].sort(() => Math.random() - 0.5)
    const { order, picks } = playOut(createRanking(many, 'full'), truth)
    expect(order).toEqual(truth)
    expect(picks).toBeLessThanOrEqual(estimatePicks(groupsFor(many, 'full')))
    expect(estimatePicks(groupsFor(many, 'full'))).toBeLessThan(250)
  })

  it('undoes the last pick exactly', () => {
    let s = createRanking(films, 'full')
    const first = replay(s).next
    s = answer(s, true)
    expect(replay(s).next).not.toEqual(first)
    s = undoAnswer(s)
    expect(replay(s).next).toEqual(first)
  })

  it('needs no picks for a single film', () => {
    expect(replay(createRanking([film('x', 3)], 'ties')).next).toBeNull()
  })
})

describe('rankingToTiers', () => {
  const tiers = defaultTiers()
  const map = defaultRatingMap(tiers)
  const films = [film('top5', 5), film('low5', 5), film('top4', 4), film('unrated', null)]

  it('keeps rating tiers and orders inside them in "ties" mode', () => {
    const result = rankingToTiers(['low5', 'top5', 'top4', 'unrated'], films, tiers, 'ties', map)
    expect(result[0].filmIds).toEqual(['low5', 'top5'])
    expect(result[1].filmIds).toEqual(['top4'])
    expect(result.flatMap((t) => t.filmIds)).not.toContain('unrated')
  })

  it('cuts the ranking into equal slices in "full" mode', () => {
    const order = Array.from({ length: 12 }, (_, i) => `f${i}`)
    const result = rankingToTiers(order, [], tiers, 'full', map)
    expect(result.map((t) => t.filmIds.length)).toEqual([2, 2, 2, 2, 2, 2])
    expect(result[0].filmIds).toEqual(['f0', 'f1'])
  })
})
