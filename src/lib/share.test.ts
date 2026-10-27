import { describe, expect, it } from 'vitest'
import {
  boardFromSharedList,
  decodeShared,
  decodeSharedList,
  encodeShared,
  encodeSharedList,
  rankingFromShared,
  sharedListFromBoard,
  sharedRankingFrom,
  sharedTournamentFrom,
  tournamentFromShared,
  type SharedList,
} from './share'
import { champion, createTournament, currentMatch, entrants, pick, standings } from './tournament'
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

describe('tournament and ranking links', () => {
  const films = Array.from({ length: 5 }, (_, i) => film(`f${i}`, `Film ${i}`))
  const matches: Record<string, Match> = { f0: { status: 'matched', tmdbId: 1, title: 'Film 0', year: 2000, posterPath: '/p0.jpg' } }

  it('round-trips a finished bracket, byes included', async () => {
    let bracket = createTournament(films)
    for (let current = currentMatch(bracket); current; current = currentMatch(bracket)) {
      bracket = pick(bracket, entrants(bracket, current.round, current.match)[1]!)
    }
    const code = await encodeShared({ kind: 'tournament', tournament: sharedTournamentFrom('Cup', bracket, matches) })
    const item = await decodeShared(code)
    if (item.kind !== 'tournament') throw new Error(item.kind)
    const rebuilt = tournamentFromShared(item.tournament)
    expect(item.tournament.title).toBe('Cup')
    expect(rebuilt.bracket.seeds.map((f) => f.name)).toEqual(films.map((f) => f.name))
    const name = (id: string | null) => rebuilt.bracket.seeds.find((f) => f.id === id)?.name
    expect(name(champion(rebuilt.bracket))).toBe(films.find((f) => f.id === champion(bracket))!.name)
    expect(standings(rebuilt.bracket).map((s) => s.place)).toEqual(standings(bracket).map((s) => s.place))
    expect(rebuilt.bracket.history).toHaveLength(bracket.history.length)
    expect(rebuilt.matches['shared-seed-0']).toMatchObject({ posterPath: '/p0.jpg' })
  })

  it('round-trips a ranking', async () => {
    const code = await encodeShared({ kind: 'ranking', ranking: sharedRankingFrom('Top', [films[2], films[0]], matches) })
    const item = await decodeShared(code)
    if (item.kind !== 'ranking') throw new Error(item.kind)
    expect(rankingFromShared(item.ranking).films.map((f) => f.name)).toEqual(['Film 2', 'Film 0'])
    await expect(decodeSharedList(code)).rejects.toThrow()
  })
})
