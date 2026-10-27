import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, countByGenre, filterFilms, findFilms, foldText, peopleIndex, sortFilms } from './filter'
import type { Film, Match } from './types'

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

describe('genre filter', () => {
  const matched = (genreIds?: number[]): Match => ({ status: 'matched', tmdbId: 1, title: '', year: null, posterPath: null, genreIds })
  const matches: Record<string, Match> = { Alien: matched([27, 878]), Brazil: matched([878, 35]), Cats: matched([10402]), Dune: matched() }

  it('keeps films with any selected genre and drops films without genre data', () => {
    const names = (genres: number[]) => filterFilms(FILMS, { ...DEFAULT_FILTERS, genres }, matches).map((f) => f.name)
    expect(names([878])).toEqual(['Alien', 'Brazil'])
    expect(names([27, 10402])).toEqual(['Alien', 'Cats'])
    expect(names([])).toHaveLength(4)
  })

  it('treats saved filters without a genres field as "all genres"', () => {
    const { genres: _g, ...old } = DEFAULT_FILTERS
    expect(filterFilms(FILMS, old as typeof DEFAULT_FILTERS, matches)).toHaveLength(4)
  })

  it('counts films per genre', () => {
    expect(Object.fromEntries(countByGenre(FILMS, matches))).toEqual({ 27: 1, 878: 2, 35: 1, 10402: 1 })
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

describe('people filter', () => {
  const matched = (tmdbId: number): Match => ({ status: 'matched', tmdbId, title: '', year: null, posterPath: null, genreIds: [] })
  const matches: Record<string, Match> = { Alien: matched(1), Brazil: matched(2), Cats: matched(3) }
  const credits = {
    1: { directors: [[10, 'Ridley Scott']] as [number, string][], cast: [[20, 'Sigourney Weaver']] as [number, string][] },
    2: { directors: [[11, 'Terry Gilliam']] as [number, string][], cast: [[20, 'Sigourney Weaver']] as [number, string][] },
  }

  it('keeps films a person directed or appears in', () => {
    expect(filterFilms(FILMS, { ...DEFAULT_FILTERS, person: 20 }, matches, credits).map((f) => f.name)).toEqual(['Alien', 'Brazil'])
    expect(filterFilms(FILMS, { ...DEFAULT_FILTERS, person: 10 }, matches, credits).map((f) => f.name)).toEqual(['Alien'])
  })

  it('indexes everyone with their counts', () => {
    const people = peopleIndex(FILMS, matches, credits)
    expect(people.find((p) => p.id === 20)).toEqual({ id: 20, name: 'Sigourney Weaver', directed: 0, acted: 2 })
    expect(people.find((p) => p.id === 11)).toMatchObject({ directed: 1, acted: 0 })
  })
})

describe('findFilms', () => {
  const films = [film('Amélie', 4, 2001), film('Mission: Impossible - Fallout', 4, 2018), film('Dune', 4, 2021), film('Dune', 2, 1984), film('Prisoners of Dune', 3, 1999)]
  const names = (query: string) => findFilms(films, query).map((f) => `${f.name} ${f.year}`)

  it('ignores case, accents and punctuation', () => {
    expect(foldText('  Mission: Impossible – Fallout ')).toBe('mission impossible fallout')
    expect(names('amelie')).toEqual(['Amélie 2001'])
    expect(names('mission impossible')).toEqual(['Mission: Impossible - Fallout 2018'])
  })

  it('lists titles starting with the query first, and accepts a year', () => {
    expect(names('dune')).toEqual(['Dune 1984', 'Dune 2021', 'Prisoners of Dune 1999'])
    expect(names('dune 1984')).toEqual(['Dune 1984'])
  })

  it('finds nothing for an empty query, and stops at the limit', () => {
    expect(findFilms(films, ' : ')).toEqual([])
    expect(findFilms(films, 'e', 2)).toHaveLength(2)
  })
})
