import { seededRandom, shuffle } from '../random'
import type { Film, Tier } from '../types'
import type { Member, Showdown } from './types'

/** A film as seen by the group: everyone's ratings, with `rating` set to the average rounded to ½★. */
export interface GroupFilm extends Film {
  ratings: Record<string, number | null>
  watchers: string[]
  average: number | null
  /** Median of the members' ratings; used for tournament seeding. */
  median: number | null
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const titleKey = (film: Film) => `${film.name.toLowerCase()}|${film.year ?? ''}`

export function groupFilms(members: Member[]): GroupFilm[] {
  const byId = new Map<string, GroupFilm>()
  const byTitle = new Map<string, GroupFilm>()
  for (const member of members) {
    for (const film of member.films) {
      let group = byId.get(film.id) ?? byTitle.get(titleKey(film))
      if (!group) {
        group = { ...film, rating: null, watchedDate: null, ratings: {}, watchers: [], average: null, median: null }
        byId.set(film.id, group)
        byTitle.set(titleKey(film), group)
      }
      group.ratings[member.id] = film.rating
      if (!group.watchers.includes(member.id)) group.watchers.push(member.id)
    }
  }
  for (const group of byId.values()) {
    const rated = Object.values(group.ratings).filter((r): r is number => r != null)
    group.average = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null
    group.median = median(rated)
    group.rating = group.average == null ? null : Math.round(group.average * 2) / 2
  }
  return [...byId.values()]
}

export interface ShowdownPickOptions {
  minWatchers: number
  count: number
  mode: 'popular' | 'random'
}

/** Films for a showdown: watched by enough members, most-watched and best-rated first (or random). */
export function pickShowdownFilms(films: GroupFilm[], { minWatchers, count, mode }: ShowdownPickOptions, random: () => number = Math.random): string[] {
  const eligible = films.filter((f) => f.watchers.length >= minWatchers)
  const ordered =
    mode === 'random'
      ? shuffle(eligible, random)
      : [...eligible].sort((a, b) => b.watchers.length - a.watchers.length || (b.average ?? -1) - (a.average ?? -1) || a.name.localeCompare(b.name))
  return ordered.slice(0, count).map((f) => f.id)
}

export interface ShowdownResults {
  best: { memberId: string; votes: number }[]
  worst: { memberId: string; votes: number }[]
  /** Films whose tier placement varied the most between members. */
  controversial: { filmId: string; spread: number }[]
  /** Films everyone put in the same tier. */
  unanimous: { filmId: string; tierIndex: number }[]
}

function tally(votes: (string | null)[]): { memberId: string; votes: number }[] {
  const counts = new Map<string, number>()
  for (const id of votes) if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].map(([memberId, n]) => ({ memberId, votes: n })).sort((a, b) => b.votes - a.votes)
}

function tierIndexOf(tiers: Tier[], filmId: string): number | null {
  const index = tiers.findIndex((t) => t.filmIds.includes(filmId))
  return index < 0 ? null : index
}

export function showdownResults(showdown: Showdown): ShowdownResults {
  const votes = Object.values(showdown.votes)
  const boards = Object.values(showdown.boards)
  const controversial: ShowdownResults['controversial'] = []
  const unanimous: ShowdownResults['unanimous'] = []
  for (const filmId of showdown.filmIds) {
    const placed = boards.map((b) => tierIndexOf(b, filmId)).filter((i): i is number => i != null)
    if (placed.length < 2) continue
    const spread = Math.max(...placed) - Math.min(...placed)
    if (spread === 0 && placed.length === boards.length) unanimous.push({ filmId, tierIndex: placed[0] })
    else controversial.push({ filmId, spread })
  }
  return {
    best: tally(votes.map((v) => v.best)),
    worst: tally(votes.map((v) => v.worst)),
    controversial: controversial.sort((a, b) => b.spread - a.spread),
    unanimous,
  }
}

/** Order of the lists in a guess-mode reveal: shuffled, but identical for everyone in the room. */
export function anonymousOrder(showdown: Showdown): string[] {
  const owners = Object.keys(showdown.boards).sort()
  return shuffle(owners, seededRandom(`${showdown.round}:${owners.join(',')}`))
}

/** "A", "B"… for anonymous lists. */
export const listLetter = (index: number) => String.fromCharCode(65 + (index % 26))

export interface GuessResults {
  /** Who guessed the most authors right. `total` is how many lists they could guess (everyone's but their own). */
  detectives: { memberId: string; correct: number; total: number }[]
  /** How many guessers recognised each list's author. */
  recognised: { ownerId: string; correct: number; guessers: number }[]
}

export function guessResults(showdown: Showdown): GuessResults {
  const owners = Object.keys(showdown.boards)
  const detectives = Object.entries(showdown.guesses)
    .map(([memberId, guesses]) => ({
      memberId,
      correct: owners.filter((owner) => owner !== memberId && guesses[owner] === owner).length,
      total: owners.filter((owner) => owner !== memberId).length,
    }))
    .sort((a, b) => b.correct - a.correct)
  const recognised = owners
    .map((ownerId) => {
      const about = Object.entries(showdown.guesses).filter(([guesser, guesses]) => guesser !== ownerId && guesses[ownerId])
      return { ownerId, correct: about.filter(([, guesses]) => guesses[ownerId] === ownerId).length, guessers: about.length }
    })
    .sort((a, b) => b.correct - a.correct)
  return { detectives, recognised }
}

const MEMBER_COLORS = ['#ff8000', '#00e054', '#40bcf4', '#e85dff', '#ffd84a', '#ff5c7a', '#7cf0c5', '#a98bff']

export function memberColor(memberId: string): string {
  let hash = 0
  for (const char of memberId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return MEMBER_COLORS[hash % MEMBER_COLORS.length]
}
