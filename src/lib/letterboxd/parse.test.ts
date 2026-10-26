import { describe, expect, it } from 'vitest'
import { mergeExport, parseRating, rowToFilm } from './parse'

const WATCHED = `Date,Name,Year,Letterboxd URI
2023-01-02,Parasite,2019,https://boxd.it/hTha
2023-02-03,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/1Zs6
2023-03-04,Unrated Film,1999,https://boxd.it/aaaa
`

const RATINGS = `﻿Date,Name,Year,Letterboxd URI,Rating
2023-01-05,Parasite,2019,https://boxd.it/hTha,5
2023-02-06,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/1Zs6,3.5
2023-04-01,Only Rated,2010,https://boxd.it/bbbb,0.5
`

describe('parseRating', () => {
  it('parses half-star ratings and rejects empty/invalid values', () => {
    expect(parseRating('4.5')).toBe(4.5)
    expect(parseRating('4,5')).toBe(4.5)
    expect(parseRating('')).toBeNull()
    expect(parseRating('abc')).toBeNull()
    expect(parseRating('0')).toBeNull()
    expect(parseRating('7')).toBe(5)
  })
})

describe('rowToFilm', () => {
  it('accepts alternative header names', () => {
    const film = rowToFilm({ title: 'Heat', year: '1995', url: 'https://boxd.it/x', rating: '4' })
    expect(film).toMatchObject({ id: 'https://boxd.it/x', name: 'Heat', year: 1995, rating: 4 })
  })

  it('falls back to a local id when there is no URI', () => {
    expect(rowToFilm({ name: 'Heat', year: '1995' })?.id).toBe('local:heat|1995')
  })

  it('skips rows without a title', () => {
    expect(rowToFilm({ name: '', year: '1995' })).toBeNull()
  })
})

describe('mergeExport', () => {
  it('merges ratings into watched films and keeps unrated and rating-only films', () => {
    const films = mergeExport({ watched: WATCHED, ratings: RATINGS })
    const byName = Object.fromEntries(films.map((f) => [f.name, f]))

    expect(films).toHaveLength(4)
    expect(byName['Parasite']).toMatchObject({ rating: 5, year: 2019, watchedDate: '2023-01-02' })
    expect(byName['Crouching Tiger, Hidden Dragon'].rating).toBe(3.5)
    expect(byName['Unrated Film'].rating).toBeNull()
    expect(byName['Only Rated']).toMatchObject({ rating: 0.5, watchedDate: null })
  })

  it('matches by title and year when URIs differ between files', () => {
    const ratings = 'Date,Name,Year,Letterboxd URI,Rating\n2023-01-05,Parasite,2019,https://letterboxd.com/film/parasite-2019/,4\n'
    const films = mergeExport({ watched: WATCHED, ratings })
    expect(films).toHaveLength(3)
    expect(films.find((f) => f.name === 'Parasite')?.rating).toBe(4)
  })

  it('works with only one of the files', () => {
    expect(mergeExport({ ratings: RATINGS })).toHaveLength(3)
    expect(mergeExport({ watched: WATCHED }).every((f) => f.rating === null)).toBe(true)
  })
})
