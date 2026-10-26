export interface Film {
  /** Stable key: the Letterboxd URI, or `local:<name>|<year>` when the export has none. */
  id: string
  name: string
  year: number | null
  uri: string
  /** 0.5–5 in half-star steps, or null when the film was watched but not rated. */
  rating: number | null
  watchedDate: string | null
}

export type Match =
  | {
      status: 'matched'
      tmdbId: number
      title: string
      year: number | null
      posterPath: string | null
      /** True when the user picked this match by hand; never overwritten automatically. */
      manual?: boolean
    }
  | { status: 'notfound' }

export interface Tier {
  id: string
  label: string
  color: string
  filmIds: string[]
}

/** Maps a rating ("0.5" … "5") to a tier id; "" leaves those films in the pool. */
export type RatingMap = Record<string, string>

export interface Filters {
  /** Ratings to include. */
  ratings: number[]
  includeUnrated: boolean
  search: string
  yearMin: number | null
  yearMax: number | null
}

export type PoolSort = 'rating' | 'title' | 'year' | 'watched'
