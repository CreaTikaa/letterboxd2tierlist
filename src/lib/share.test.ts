import { describe, expect, it } from 'vitest'
import { boardFromSharedList, decodeSharedList, encodeSharedList, sharedListFromBoard, type SharedList } from './share'
import { defaultTiers } from './tiers'
import type { Film, Match } from './types'

const film = (id: string, name: string, year: number | null = 2000): Film => ({ id, name, year, uri: '', rating: 4, watchedDate: null })

describe('share links', () => {
  const list: SharedList = {
    title: 'My list — été 2025 ★',
    tiers: [
      { label: 'S', color: '#ff7f7f', films: [{ name: 'Amélie', year: 2001, poster: '/abcDEF123.jpg' }] },
      { label: 'A tier with a long name', color: '#ffbf7f', films: [{ name: '千と千尋の神隠し', year: null, poster: null }] },
      { label: 'F', color: '#7fff7f', films: [] },
    ],
  }

  it('round-trips through a URL-safe code', async () => {
    const code = await encodeSharedList(list)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await decodeSharedList(code)).toEqual(list)
  })

  it('keeps non-.jpg posters intact', async () => {
    const png: SharedList = { title: '', tiers: [{ label: 'S', color: '#fff', films: [{ name: 'x', year: 1, poster: '/x.png' }] }] }
    expect(await decodeSharedList(await encodeSharedList(png))).toEqual(png)
  })

  it('stays reasonably short for a typical board', async () => {
    const big: SharedList = {
      title: 'Big',
      tiers: defaultTiers().map((t, i) => ({
        label: t.label,
        color: t.color,
        films: Array.from({ length: 10 }, (_, j) => ({ name: `Film number ${i}-${j}`, year: 1990 + j, poster: `/poster${i}${j}abcdefghijklmnopqr.jpg` })),
      })),
    }
    const code = await encodeSharedList(big)
    // 60 films with random-looking poster ids: the posters dominate, but compression still helps.
    expect(code.length).toBeLessThan(2400)
  })

  it('rejects broken links', async () => {
    await expect(decodeSharedList('not-a-real-code')).rejects.toThrow(/broken/)
  })

  it('snapshots a board and rebuilds it for display', () => {
    const tiers = defaultTiers()
    tiers[0].filmIds = ['a', 'hidden']
    tiers[1].filmIds = ['b']
    const matches: Record<string, Match> = { a: { status: 'matched', tmdbId: 1, title: 'A', year: 2000, posterPath: '/a.jpg' }, b: { status: 'notfound' } }
    const shared = sharedListFromBoard('T', tiers, [film('a', 'Alpha'), film('b', 'Beta')], matches)
    expect(shared.tiers[0].films).toEqual([{ name: 'Alpha', year: 2000, poster: '/a.jpg' }])

    const board = boardFromSharedList(shared)
    expect(board.tiers[0].filmIds).toEqual(['shared-0-0'])
    expect(board.films.map((f) => f.name)).toEqual(['Alpha', 'Beta'])
    expect(board.matches['shared-0-0']).toMatchObject({ posterPath: '/a.jpg' })
    expect(board.matches['shared-1-0']).toEqual({ status: 'notfound' })
  })
})
