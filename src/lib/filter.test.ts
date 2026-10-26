import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, filterFilms, sortFilms } from './filter'
import type { Film } from './types'

const film = (name: string, rating: number | null, year: number | null = 2000, watchedDate: string | null = null): Film => ({
  id: name,
  name,
  year,
  uri: '',
  rating,
  watchedDate,
})

const FILMS = [film('Alien', 5, 1979), film('Brazil', 3.5, 1985), film('Cats', 0.5, 2019), film('Dune', null, 2021)]

describe('filterFilms', () => {
  it('keeps everything with the default filters', () => {
    expect(filterFilms(FILMS, DEFAULT_FILTERS)).toHaveLength(4)
  })

  it('keeps only the selected ratings', () => {
    const names = filterFilms(FILMS, { ...DEFAULT_FILTERS, ratings: [5, 3.5] }).map((f) => f.name)
    expect(names).toEqual(['Alien', 'Brazil', 'Dune'])
  })

  it('can hide unrated films', () => {
    expect(filterFilms(FILMS, { ...DEFAULT_FILTERS, includeUnrated: false }).map((f) => f.name)).not.toContain('Dune')
  })

  it('filters by title search and year range', () => {
    expect(filterFilms(FILMS, { ...DEFAULT_FILTERS, search: 'ALI' }).map((f) => f.name)).toEqual(['Alien'])
    expect(filterFilms(FILMS, { ...DEFAULT_FILTERS, yearMin: 1980, yearMax: 2020 }).map((f) => f.name)).toEqual(['Brazil', 'Cats'])
  })
})

describe('sortFilms', () => {
  it('sorts by rating with unrated last, then by title', () => {
    const sorted = sortFilms([film('Zed', 4), film('Dune', null), film('Abe', 4), film('Max', 5)], 'rating')
    expect(sorted.map((f) => f.name)).toEqual(['Max', 'Abe', 'Zed', 'Dune'])
  })

  it('sorts by most recently watched', () => {
    const sorted = sortFilms([film('Old', 3, 2000, '2020-01-01'), film('New', 3, 2000, '2024-01-01'), film('Never', 3)], 'watched')
    expect(sorted.map((f) => f.name)).toEqual(['New', 'Old', 'Never'])
  })
})
