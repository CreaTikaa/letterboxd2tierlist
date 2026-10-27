import { AppError } from './errors'
import { createTournament, entrants, type Tournament } from './tournament'
import type { Film, Match, Tier } from './types'

/**
 * Read-only tier lists, tournament results and rankings shared as a link: everything is
 * compressed into the URL (`#/view/<code>`), so nothing is stored anywhere.
 */
export interface SharedFilm {
  name: string
  year: number | null
  poster: string | null
}

export interface SharedList {
  title: string
  tiers: { label: string; color: string; films: SharedFilm[] }[]
}

export interface SharedTournament {
  title: string
  /** Seed order (index 0 = seed #1). */
  seeds: SharedFilm[]
  /** picks[round][match] = winner's seed index, or -1. */
  picks: number[][]
}

export interface SharedRanking {
  title: string
  /** Best first. */
  films: SharedFilm[]
}

export type SharedItem =
  | { kind: 'tierlist'; list: SharedList }
  | { kind: 'tournament'; tournament: SharedTournament }
  | { kind: 'ranking'; ranking: SharedRanking }

// Compact wire formats; the first number says what it is:
//   [1, title, [[label, color, [film…]]…]]   tier list
//   [2, title, [film…], [[seedIndex…]…]]     tournament
//   [3, title, [film…]]                      ranking
// where film = [name, year|0, poster|''].
type WireFilm = [string, number, string]
type Wire = [1, string, [string, string, WireFilm[]][]] | [2, string, WireFilm[], number[][]] | [3, string, WireFilm[]]

/** Links longer than this get cut by some chat apps (Discord, SMS…). */
export const LONG_LINK = 2000

/** Poster paths look like "/abc123.jpg"; the slash and extension are implied in the link. */
const packPoster = (path: string | null) => (path ? path.replace(/^\//, '').replace(/\.jpg$/, '') : '')
const unpackPoster = (packed: string) => (packed ? `/${packed}${packed.includes('.') ? '' : '.jpg'}` : null)

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(output).arrayBuffer())
}

const packFilm = (f: SharedFilm): WireFilm => [f.name, f.year ?? 0, packPoster(f.poster)]
const unpackFilm = ([name, year, poster]: WireFilm): SharedFilm => ({ name, year: year || null, poster: unpackPoster(poster) })

function toWire(item: SharedItem): Wire {
  switch (item.kind) {
    case 'tierlist':
      return [1, item.list.title, item.list.tiers.map((t) => [t.label, t.color, t.films.map(packFilm)])]
    case 'tournament':
      return [2, item.tournament.title, item.tournament.seeds.map(packFilm), item.tournament.picks]
    case 'ranking':
      return [3, item.ranking.title, item.ranking.films.map(packFilm)]
  }
}

export async function encodeShared(item: SharedItem): Promise<string> {
  const compressed = await transform(new TextEncoder().encode(JSON.stringify(toWire(item))), new CompressionStream('deflate-raw'))
  return toBase64Url(compressed)
}

export const encodeSharedList = (list: SharedList) => encodeShared({ kind: 'tierlist', list })

export async function decodeShared(code: string): Promise<SharedItem> {
  let wire: Wire
  try {
    const bytes = await transform(fromBase64Url(code), new DecompressionStream('deflate-raw'))
    wire = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new AppError('brokenLink', 'This link is broken or incomplete.')
  }
  if (!Array.isArray(wire)) throw new AppError('brokenLink', 'This link is broken or incomplete.')
  switch (wire[0]) {
    case 1:
      return {
        kind: 'tierlist',
        list: { title: wire[1], tiers: wire[2].map(([label, color, films]) => ({ label, color, films: films.map(unpackFilm) })) },
      }
    case 2:
      return { kind: 'tournament', tournament: { title: wire[1], seeds: wire[2].map(unpackFilm), picks: wire[3] } }
    case 3:
      return { kind: 'ranking', ranking: { title: wire[1], films: wire[2].map(unpackFilm) } }
    default:
      throw new AppError('newerLink', 'This link was made by a newer version of the app.')
  }
}

export async function decodeSharedList(code: string): Promise<SharedList> {
  const item = await decodeShared(code)
  if (item.kind !== 'tierlist') throw new AppError('brokenLink', 'This link is not a tier list.')
  return item.list
}

/** Snapshot of a board (only the given films, in board order) ready to encode. */
export function sharedListFromBoard(title: string, tiers: Tier[], films: Film[], matches: Record<string, Match>): SharedList {
  const byId = new Map(films.map((f) => [f.id, f]))
  return {
    title,
    tiers: tiers.map((tier) => ({
      label: tier.label,
      color: tier.color,
      films: tier.filmIds.flatMap((id) => {
        const film = byId.get(id)
        if (!film) return []
        const match = matches[id]
        return [{ name: film.name, year: film.year, poster: match?.status === 'matched' ? match.posterPath : null }]
      }),
    })),
  }
}

/** Turns a shared list back into tiers, films and matches that the regular components can render. */
export function boardFromSharedList(list: SharedList): { tiers: Tier[]; films: Film[]; matches: Record<string, Match> } {
  const films: Film[] = []
  const matches: Record<string, Match> = {}
  const tiers = list.tiers.map((tier, t) => ({
    id: `shared-${t}`,
    label: tier.label,
    color: tier.color,
    filmIds: tier.films.map((film, i) => {
      const id = `shared-${t}-${i}`
      films.push({ id, name: film.name, year: film.year, uri: '', rating: null, watchedDate: null })
      matches[id] = film.poster ? { status: 'matched', tmdbId: 0, title: film.name, year: film.year, posterPath: film.poster } : { status: 'notfound' }
      return id
    }),
  }))
  return { tiers, films, matches }
}

export const shareUrl = (code: string) => `${location.origin}${location.pathname}#/view/${code}`

function sharedFilm(film: Film, matches: Record<string, Match>): SharedFilm {
  const match = matches[film.id]
  return { name: film.name, year: film.year, poster: match?.status === 'matched' ? match.posterPath : null }
}

/** Rebuilds films and poster matches for shared films, with ids `<prefix><index>`. */
function filmsFromShared(shared: SharedFilm[], prefix: string): { films: Film[]; matches: Record<string, Match> } {
  const matches: Record<string, Match> = {}
  const films = shared.map((film, i) => {
    const id = `${prefix}${i}`
    matches[id] = film.poster ? { status: 'matched', tmdbId: 0, title: film.name, year: film.year, posterPath: film.poster } : { status: 'notfound' }
    return { id, name: film.name, year: film.year, uri: '', rating: null, watchedDate: null }
  })
  return { films, matches }
}

export function sharedTournamentFrom(title: string, bracket: Tournament, matches: Record<string, Match>): SharedTournament {
  const seedIndex = new Map(bracket.seeds.map((f, i) => [f.id, i]))
  return {
    title,
    seeds: bracket.seeds.map((f) => sharedFilm(f, matches)),
    picks: bracket.picks.map((round) => round.map((id) => (id ? (seedIndex.get(id) ?? -1) : -1))),
  }
}

/** A finished (or partial) bracket rebuilt from a link, ready for the regular results views. */
export function tournamentFromShared(shared: SharedTournament): { bracket: Tournament; matches: Record<string, Match> } {
  const { films, matches } = filmsFromShared(shared.seeds, 'shared-seed-')
  // Keep the seeds' ratings unknown: links don't carry anyone's ratings.
  const bracket = createTournament(films, 'shared')
  const picks = bracket.picks.map((round, r) => round.map((_, m) => films[shared.picks[r]?.[m] ?? -1]?.id ?? null))
  const withPicks = { ...bracket, picks }
  const history = picks.flatMap((round, r) => round.flatMap((id, m) => (id && entrants(withPicks, r, m).every(Boolean) ? [{ round: r, match: m }] : [])))
  return { bracket: { ...withPicks, history }, matches }
}

export function sharedRankingFrom(title: string, order: Film[], matches: Record<string, Match>): SharedRanking {
  return { title, films: order.map((f) => sharedFilm(f, matches)) }
}

export function rankingFromShared(shared: SharedRanking): { films: Film[]; matches: Record<string, Match> } {
  return filmsFromShared(shared.films, 'shared-rank-')
}
