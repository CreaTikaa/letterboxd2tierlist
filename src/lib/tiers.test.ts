import { describe, expect, it } from 'vitest'
import { autoFill, defaultRatingMap, defaultTiers } from './tiers'
import type { Film } from './types'

const film = (id: string, rating: number | null): Film => ({ id, name: id, year: 2000, uri: '', rating, watchedDate: null })

describe('defaultRatingMap', () => {
  it('maps 5 to S, half-star pairs to the following tiers and 0.5 to F', () => {
    const map = defaultRatingMap(defaultTiers())
    expect(map['5']).toBe('tier-s')
    expect([map['4.5'], map['4']]).toEqual(['tier-a', 'tier-a'])
    expect([map['1.5'], map['1']]).toEqual(['tier-d', 'tier-d'])
    expect(map['0.5']).toBe('tier-f')
  })
})

describe('autoFill', () => {
  const tiers = defaultTiers()
  const map = defaultRatingMap(tiers)

  it('places rated films by rating, best first, and leaves unrated ones out', () => {
    const result = autoFill(tiers, [film('b', 4), film('a', 4.5), film('s', 5), film('u', null)], map)
    const byId = Object.fromEntries(result.map((t) => [t.id, t.filmIds]))
    expect(byId['tier-s']).toEqual(['s'])
    expect(byId['tier-a']).toEqual(['a', 'b'])
    expect(result.flatMap((t) => t.filmIds)).not.toContain('u')
  })

  it('keeps the placement of films outside the given set', () => {
    const start = tiers.map((t) => (t.id === 'tier-f' ? { ...t, filmIds: ['hidden', 'moved'] } : t))
    const result = autoFill(start, [film('moved', 5)], map)
    expect(result.find((t) => t.id === 'tier-f')!.filmIds).toEqual(['hidden'])
    expect(result.find((t) => t.id === 'tier-s')!.filmIds).toEqual(['moved'])
  })

  it('leaves films whose rating maps to no tier in the pool', () => {
    const result = autoFill(tiers, [film('x', 5)], { ...map, '5': '' })
    expect(result.flatMap((t) => t.filmIds)).toEqual([])
  })
})
