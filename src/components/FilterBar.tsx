import { useMemo, useState, type ReactNode } from 'react'
import { countByGenre, countByRating } from '../lib/filter'
import { genreName } from '../lib/genres'
import { RATING_VALUES, stars } from '../lib/ratings'
import type { Film, Filters, Match } from '../lib/types'
import { useStore } from '../store/useStore'
import { Button, inputClass } from './ui'

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition ${
        active ? 'border-lb-green/60 bg-lb-green/15 text-text' : 'border-line text-muted/70 line-through decoration-muted/50 hover:text-muted'
      }`}
    >
      {children}
    </button>
  )
}

/** Genre chips start "off" (no strike-through) since an empty selection means every genre. */
function GenreChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition ${
        active ? 'border-lb-blue/60 bg-lb-blue/15 text-text' : 'border-line text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

const parseYear = (value: string) => (/^\d{4}$/.test(value) ? Number(value) : null)

/** Keeps the typed text locally so partial years ("19") don't get wiped while typing. */
function YearInput({ value, onChange, placeholder }: { value: number | null; onChange: (year: number | null) => void; placeholder: string }) {
  const [text, setText] = useState(value?.toString() ?? '')
  const [lastValue, setLastValue] = useState(value)
  // Sync with outside changes (e.g. loading a save file).
  if (value !== lastValue) {
    setLastValue(value)
    if (parseYear(text) !== value) setText(value?.toString() ?? '')
  }
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseYear(e.target.value))
      }}
      className={`${inputClass} w-20`}
    />
  )
}

interface Props {
  /** All films the filters apply to (used for the per-rating counts). */
  films: Film[]
  filters: Filters
  onChange: (filters: Partial<Filters>) => void
  /** Number of films passing the filters. */
  visibleCount: number
  ratingLabel?: string
  /** Extra controls on the second row. */
  extra?: ReactNode
  /** Poster matches, which carry genres; without them the genre row is hidden. */
  matches?: Record<string, Match>
}

export function FilterBar({ films, filters, onChange: setFilters, visibleCount, ratingLabel = 'Ratings', extra, matches }: Props) {
  const cardWidth = useStore((s) => s.cardWidth)
  const setCardWidth = useStore((s) => s.setCardWidth)
  const showRatings = useStore((s) => s.showRatings)
  const setShowRatings = useStore((s) => s.setShowRatings)
  const counts = useMemo(() => countByRating(films), [films])
  const genreCounts = useMemo(() => (matches ? [...countByGenre(films, matches)].sort((a, b) => b[1] - a[1]) : []), [films, matches])
  const selected = new Set(filters.ratings)
  const selectedGenres = new Set(filters.genres ?? [])
  const toggleGenre = (genre: number) =>
    setFilters({ genres: selectedGenres.has(genre) ? [...selectedGenres].filter((g) => g !== genre) : [...selectedGenres, genre] })

  const toggleRating = (rating: number) =>
    setFilters({ ratings: selected.has(rating) ? filters.ratings.filter((r) => r !== rating) : [...filters.ratings, rating] })

  /** Keeps only ratings >= min (and drops unrated). */
  const atLeast = (min: number) => setFilters({ ratings: RATING_VALUES.filter((r) => r >= min), includeUnrated: false })

  return (
    <div className="space-y-3 rounded-xl bg-panel p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold tracking-wide text-muted uppercase">{ratingLabel}</span>
        {RATING_VALUES.map((rating) => (
          <Chip key={rating} active={selected.has(rating)} onClick={() => toggleRating(rating)} title={`${rating} stars`}>
            <span className="text-lb-green">{stars(rating)}</span> <span className="text-muted">{counts.get(rating) ?? 0}</span>
          </Chip>
        ))}
        <Chip active={filters.includeUnrated} onClick={() => setFilters({ includeUnrated: !filters.includeUnrated })}>
          Unrated <span className="text-muted">{counts.get(null) ?? 0}</span>
        </Chip>
        <span className="mx-1 h-4 w-px bg-line" />
        <Button variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => setFilters({ ratings: [...RATING_VALUES], includeUnrated: true })}>
          All
        </Button>
        <Button variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => setFilters({ ratings: [], includeUnrated: false })}>
          None
        </Button>
        {[4, 3].map((min) => (
          <Button key={min} variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => atLeast(min)}>
            {min}★+
          </Button>
        ))}
      </div>

      {genreCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold tracking-wide text-muted uppercase">Genres</span>
          <GenreChip active={selectedGenres.size === 0} onClick={() => setFilters({ genres: [] })}>
            Any
          </GenreChip>
          {genreCounts.map(([genre, count]) => (
            <GenreChip key={genre} active={selectedGenres.has(genre)} onClick={() => toggleGenre(genre)}>
              {genreName(genre)} <span className="text-muted">{count}</span>
            </GenreChip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input
          type="search"
          placeholder="Search titles…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className={`${inputClass} w-48`}
        />
        <label className="flex items-center gap-1.5 text-muted">
          Years
          <YearInput placeholder="from" value={filters.yearMin} onChange={(yearMin) => setFilters({ yearMin })} />
          –
          <YearInput placeholder="to" value={filters.yearMax} onChange={(yearMax) => setFilters({ yearMax })} />
        </label>
        <span className="text-muted">
          Showing <span className="font-semibold text-text">{visibleCount}</span> of {films.length}
        </span>
        {extra}

        <div className="ml-auto flex items-center gap-4 text-muted">
          <label className="flex items-center gap-2">
            Size
            <input type="range" min={48} max={140} step={4} value={cardWidth} onChange={(e) => setCardWidth(Number(e.target.value))} className="w-24 accent-lb-green" />
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showRatings} onChange={(e) => setShowRatings(e.target.checked)} className="accent-lb-green" />
            Show stars
          </label>
        </div>
      </div>
    </div>
  )
}
