import type { Film, Match, Tier } from './types'

/**
 * Read-only tier lists shared as a link: the whole list is compressed into the URL
 * (`#/view/<code>`), so nothing is stored anywhere.
 */
export interface SharedList {
  title: string
  tiers: { label: string; color: string; films: { name: string; year: number | null; poster: string | null }[] }[]
}

// Compact wire format: [version, title, [[label, color, [[name, year|0, poster|'']…]]…]]
type Wire = [1, string, [string, string, [string, number, string][]][]]

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

export async function encodeSharedList(list: SharedList): Promise<string> {
  const wire: Wire = [1, list.title, list.tiers.map((t) => [t.label, t.color, t.films.map((f) => [f.name, f.year ?? 0, packPoster(f.poster)])])]
  const compressed = await transform(new TextEncoder().encode(JSON.stringify(wire)), new CompressionStream('deflate-raw'))
  return toBase64Url(compressed)
}

export async function decodeSharedList(code: string): Promise<SharedList> {
  let wire: Wire
  try {
    const bytes = await transform(fromBase64Url(code), new DecompressionStream('deflate-raw'))
    wire = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('This link is broken or incomplete.')
  }
  if (!Array.isArray(wire) || wire[0] !== 1) throw new Error('This link was made by a newer version of the app.')
  return {
    title: wire[1],
    tiers: wire[2].map(([label, color, films]) => ({
      label,
      color,
      films: films.map(([name, year, poster]) => ({ name, year: year || null, poster: unpackPoster(poster) })),
    })),
  }
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
