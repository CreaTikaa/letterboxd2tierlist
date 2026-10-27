import { describe, expect, it } from 'vitest'
import {
  champion,
  createTournament,
  currentMatch,
  entrants,
  nextPowerOfTwo,
  pick,
  placeLabel,
  playableMatchCount,
  roundName,
  seedFilms,
  seedPositions,
  standings,
  standingsToTiers,
  undo,
  upsets,
  type Tournament,
} from './tournament'
import { defaultTiers } from './tiers'
import type { Film } from './types'

const film = (id: string, rating: number | null = null): Film => ({ id, name: id, year: 2000, uri: '', rating, watchedDate: null })
const seeds = (n: number) => Array.from({ length: n }, (_, i) => film(`s${i + 1}`, 5 - i * 0.1))

/** Plays the bracket to the end, always picking the better seed (or a custom chooser). */
function playOut(t: Tournament, choose = (a: string, b: string) => (Number(a.slice(1)) < Number(b.slice(1)) ? a : b)) {
  let current = currentMatch(t)
  while (current) {
    const [a, b] = entrants(t, current.round, current.match)
    t = pick(t, choose(a!, b!))
    current = currentMatch(t)
  }
  return t
}

describe('seeding', () => {
  it('rounds sizes up to a power of two', () => {
    expect([2, 3, 8, 9, 100].map(nextPowerOfTwo)).toEqual([2, 4, 8, 16, 128])
  })

  it('places seeds so 1 and 2 only meet in the final', () => {
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    const order = seedPositions(64)
    expect(order.indexOf(1) < 32).toBe(true)
    expect(order.indexOf(2) >= 32).toBe(true)
    expect(new Set(order).size).toBe(64)
  })

  it('takes the best-rated films in "top" mode, seeded by rating, unrated last', () => {
    const films = [film('a', 3), film('b', 5), film('c', null), film('d', 4), film('e', 1)]
    expect(seedFilms(films, 3, 'top').map((f) => f.id)).toEqual(['b', 'd', 'a'])
    expect(seedFilms(films, 5, 'top').at(-1)!.id).toBe('c')
  })

  it('draws a random sample in "random" mode but still seeds it by rating', () => {
    const films = Array.from({ length: 20 }, (_, i) => film(`f${i}`, (i % 10) / 2 + 0.5))
    const chosen = seedFilms(films, 8, 'random')
    expect(chosen).toHaveLength(8)
    const ratings = chosen.map((f) => f.rating!)
    expect([...ratings].sort((a, b) => b - a)).toEqual(ratings)
  })
})

describe('bracket', () => {
  it('plays a full 8-film bracket in 7 matches', () => {
    let t = createTournament(seeds(8))
    expect(playableMatchCount(t)).toBe(7)
    expect(roundName(t.size, 0)).toBe('Quarter-finals')
    expect(currentMatch(t)).toEqual({ round: 0, match: 0 })
    expect(entrants(t, 0, 0)).toEqual(['s1', 's8'])
    t = playOut(t)
    expect(champion(t)).toBe('s1')
    expect(t.history).toHaveLength(7)
  })

  it('gives byes to the top seeds', () => {
    const t = createTournament(seeds(5))
    expect(t.size).toBe(8)
    expect(playableMatchCount(t)).toBe(4)
    // Only 4 vs 5 is played in round one; seeds 1–3 advance automatically.
    expect(t.picks[0].filter(Boolean).sort()).toEqual(['s1', 's2', 's3'])
    expect(entrants(t, 0, currentMatch(t)!.match).sort()).toEqual(['s4', 's5'])
  })

  it('rejects picks outside the current match and undoes the last pick', () => {
    let t = createTournament(seeds(4))
    expect(() => pick(t, 's2')).toThrow()
    t = pick(t, 's4')
    expect(currentMatch(t)).toEqual({ round: 0, match: 1 })
    t = undo(t)
    expect(currentMatch(t)).toEqual({ round: 0, match: 0 })
    expect(t.picks[0][0]).toBeNull()
  })

  it('never undoes byes', () => {
    const t = undo(createTournament(seeds(3)))
    expect(t.picks[0].filter(Boolean)).toEqual(['s1'])
  })

  it('needs at least two films', () => {
    expect(() => createTournament(seeds(1))).toThrow()
  })
})

describe('results', () => {
  it('ranks films by the round they went out in', () => {
    const t = playOut(createTournament(seeds(8)))
    const places = standings(t).map((s) => [s.filmId, s.place])
    expect(places).toEqual([
      ['s1', 1],
      ['s2', 2],
      ['s3', 3],
      ['s4', 3],
      ['s5', 5],
      ['s6', 5],
      ['s7', 5],
      ['s8', 5],
    ])
    expect(placeLabel(1)).toBe('Champion')
    expect(placeLabel(3)).toBe('3rd–4th')
    expect(placeLabel(5)).toBe('5th–8th')
  })

  it('includes films that got a bye', () => {
    const t = playOut(createTournament(seeds(5)))
    expect(standings(t)).toHaveLength(5)
  })

  it('lists upsets biggest first', () => {
    // Always pick the worse seed.
    const t = playOut(createTournament(seeds(4)), (a, b) => (Number(a.slice(1)) > Number(b.slice(1)) ? a : b))
    expect(champion(t)).toBe('s4')
    const list = upsets(t)
    expect(list[0]).toMatchObject({ winnerId: 's4', loserId: 's1', gap: 3 })
    expect(list.every((u) => u.gap > 0)).toBe(true)
  })
})

describe('standingsToTiers', () => {
  it('puts the champion in S, runner-up in A, semis in B, quarters in C', () => {
    const t = playOut(createTournament(seeds(8)))
    const tiers = standingsToTiers(t, defaultTiers())
    expect(tiers.map((tier) => tier.filmIds)).toEqual([['s1'], ['s2'], ['s3', 's4'], ['s5', 's6', 's7', 's8'], [], []])
  })

  it('sends deeper rounds to the last tier and keeps other films where they were', () => {
    const t = playOut(createTournament(seeds(32)))
    const board = defaultTiers().slice(0, 3)
    board[1].filmIds = ['other', 's1']
    const tiers = standingsToTiers(t, board)
    expect(tiers[0].filmIds).toEqual(['s1'])
    expect(tiers[1].filmIds).toEqual(['other', 's2'])
    expect(tiers[2].filmIds).toHaveLength(30)
  })
})
