import Papa from 'papaparse'
import type { Film } from '../types'

type Row = Record<string, string>

export interface ExportCsvs {
  watched?: string
  ratings?: string
}

const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/[\s_-]+/g, '')

// Header lookup is alias-based so small differences between export versions don't break parsing.
const ALIASES = {
  name: ['name', 'title', 'filmname'],
  year: ['year', 'releaseyear'],
  uri: ['letterboxduri', 'uri', 'url'],
  rating: ['rating'],
  date: ['date', 'watcheddate'],
} as const

export function parseCsv(text: string): Row[] {
  const result = Papa.parse<Row>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  })
  return result.data
}

function pick(row: Row, field: keyof typeof ALIASES): string {
  for (const alias of ALIASES[field]) {
    const value = row[alias]
    if (value != null && value.trim() !== '') return value.trim()
  }
  return ''
}

export function parseRating(raw: string): number | null {
  if (!raw) return null
  const n = Number(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(5, Math.max(0.5, Math.round(n * 2) / 2))
}

export function rowToFilm(row: Row): Film | null {
  const name = pick(row, 'name')
  if (!name) return null
  const yearRaw = pick(row, 'year')
  const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null
  const uri = pick(row, 'uri')
  return {
    id: uri || `local:${name.toLowerCase()}|${year ?? ''}`,
    name,
    year,
    uri,
    rating: parseRating(pick(row, 'rating')),
    watchedDate: pick(row, 'date') || null,
  }
}

const titleKey = (film: Film) => `${film.name.toLowerCase()}|${film.year ?? ''}`

/**
 * Builds the film library: every film from watched.csv, with ratings from ratings.csv merged in.
 * Films are matched by URI first, then by title + year in case the two files use different URIs.
 */
export function mergeExport({ watched, ratings }: ExportCsvs): Film[] {
  const byId = new Map<string, Film>()
  const byTitle = new Map<string, Film>()

  const add = (film: Film) => {
    const existing = byId.get(film.id) ?? byTitle.get(titleKey(film))
    if (existing) {
      if (film.rating != null) existing.rating = film.rating
      existing.watchedDate ??= film.watchedDate
      return
    }
    byId.set(film.id, film)
    byTitle.set(titleKey(film), film)
  }

  for (const row of watched ? parseCsv(watched) : []) {
    const film = rowToFilm(row)
    // watched.csv has no rating column; ignore one if a future export adds it.
    if (film) add({ ...film, rating: null })
  }
  for (const row of ratings ? parseCsv(ratings) : []) {
    const film = rowToFilm(row)
    if (film) add({ ...film, watchedDate: null })
  }
  return [...byId.values()]
}
