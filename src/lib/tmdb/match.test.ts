import { describe, expect, it } from 'vitest'
import type { TmdbMovie } from './client'
import { normalizeTitle, pickBest } from './match'

const movie = (id: number, title: string, release_date: string, popularity = 1, original_title = title): TmdbMovie => ({
  id,
  title,
  original_title,
  release_date,
  poster_path: `/${id}.jpg`,
  popularity,
})

describe('normalizeTitle', () => {
  it('ignores accents, punctuation, case and "&"', () => {
    expect(normalizeTitle('Amélie')).toBe('amelie')
    expect(normalizeTitle('Fast & Furious: Tokyo Drift')).toBe('fast and furious tokyo drift')
  })

  it('keeps non-Latin titles comparable', () => {
    expect(normalizeTitle('千と千尋の神隠し')).toBe('千と千尋の神隠し')
  })
})

describe('pickBest', () => {
  it('prefers an exact title with the right year over a more relevant-ranked result', () => {
    const results = [movie(1, 'Dune: Part Two', '2024-02-27', 90), movie(2, 'Dune', '2021-09-15', 50), movie(3, 'Dune', '1984-12-14', 20)]
    expect(pickBest(results, 'Dune', 2021)?.movie.id).toBe(2)
    expect(pickBest(results, 'Dune', 1984)?.movie.id).toBe(3)
  })

  it('matches on the original title too', () => {
    const results = [movie(1, 'Spirited Away', '2001-07-20', 50, '千と千尋の神隠し'), movie(2, 'Other', '2001-01-01', 80)]
    expect(pickBest(results, '千と千尋の神隠し', 2001)?.movie.id).toBe(1)
  })

  it('accepts a release year one off', () => {
    const results = [movie(1, 'Something Else', '2019-01-01', 60), movie(2, 'Parasite', '2019-05-30', 40)]
    expect(pickBest(results, 'Parasite', 2020)?.movie.id).toBe(2)
  })

  it('returns null without results', () => {
    expect(pickBest([], 'Anything', 2000)).toBeNull()
  })
})
