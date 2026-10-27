import { describe, expect, it } from 'vitest'
import { sourceFilms } from '../filter'
import type { Film } from '../types'
import { applyLikes, parseList } from './parse'

const film = (id: string, name: string, rating: number | null = 3): Film => ({ id, name, year: 2000, uri: id, rating, watchedDate: null })

const LIST = `Letterboxd list export v7
Date,Name,Tags,URL,Description
2024-01-01,"Best of, the 2000s",,https://letterboxd.com/me/list/best/,Some text

Position,Name,Year,URL,Description
1,Alpha,2000,https://boxd.it/a,
2,Never Seen,2000,https://boxd.it/zz,
3,Beta,2000,https://letterboxd.com/film/beta/,
`

describe('parseList', () => {
  it('reads the list name and its entries in order', () => {
    const list = parseList(LIST, 'lists/best-of-the-2000s.csv')!
    expect(list.id).toBe('best-of-the-2000s')
    expect(list.name).toBe('Best of, the 2000s')
    expect(list.films.map((f) => f.name)).toEqual(['Alpha', 'Never Seen', 'Beta'])
  })

  it('falls back to the file name and plain entry tables', () => {
    const list = parseList('Position,Name,Year,URL\n1,Alpha,2000,https://boxd.it/a\n', 'lists/my_list.csv')!
    expect(list.name).toBe('My list')
    expect(list.films).toHaveLength(1)
  })

  it('ignores empty lists', () => {
    expect(parseList('Letterboxd list export v7\nDate,Name\n2024-01-01,Empty\n\nPosition,Name,Year,URL\n', 'lists/e.csv')).toBeNull()
  })
})

describe('likes and sources', () => {
  const library = [film('https://boxd.it/a', 'Alpha', 5), film('https://boxd.it/b', 'Beta', 2), film('https://boxd.it/c', 'Gamma')]

  it('marks liked films by URI or title + year', () => {
    const liked = applyLikes(library, 'Date,Name,Year,Letterboxd URI\n2024-01-01,Alpha,2000,https://boxd.it/a\n2024-01-01,Gamma,2000,https://other/\n')
    expect(liked.filter((f) => f.liked).map((f) => f.name)).toEqual(['Alpha', 'Gamma'])
    expect(sourceFilms(liked, [], 'liked')).toHaveLength(2)
  })

  it("uses your rated copy of list films and keeps films you haven't seen", () => {
    const list = parseList(LIST, 'lists/best.csv')!
    const films = sourceFilms(library, [list], 'list:best')
    expect(films.map((f) => [f.name, f.rating])).toEqual([
      ['Alpha', 5],
      ['Never Seen', null],
      ['Beta', 2],
    ])
    expect(sourceFilms(library, [list], 'list:missing')).toBe(library)
    expect(sourceFilms(library, [list], 'all')).toBe(library)
  })
})
