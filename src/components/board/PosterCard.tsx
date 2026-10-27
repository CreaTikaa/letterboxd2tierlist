import { useDraggable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, type ReactNode } from 'react'
import { useT } from '../../i18n'
import { stars } from '../../lib/ratings'
import { posterUrl } from '../../lib/tmdb/client'
import type { Film, Match } from '../../lib/types'

export interface CardOptions {
  width: number
  showRating: boolean
  /** Replaces the star rating strip at the bottom of the card. */
  badge?: (film: Film) => ReactNode
  onClick?: (film: Film) => void
  /** Highlighted (tap-to-place). */
  selectedId?: string | null
}

interface CardProps extends Omit<CardOptions, 'onClick'> {
  film: Film
  match: Match | undefined
  lifted?: boolean
}

export function PosterCard({ film, match, width, showRating, badge, lifted = false }: CardProps) {
  const poster = match?.status === 'matched' && match.posterPath ? posterUrl(match.posterPath, width > 92 ? 'w185' : 'w154') : null
  const t = useT()
  const label = `${film.name}${film.year ? ` (${film.year})` : ''} · ${film.rating == null ? t('common.unrated') : stars(film.rating)}`
  const strip = badge ? badge(film) : film.rating != null ? stars(film.rating) : null

  return (
    <div
      title={label}
      style={{ width, height: Math.round(width * 1.5) }}
      className={`relative shrink-0 overflow-hidden rounded-[3px] bg-raised select-none ${lifted ? 'shadow-2xl ring-2 ring-lb-green' : ''}`}
    >
      {poster ? (
        <img src={poster} alt={label} loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-0.5 p-1 text-center leading-tight">
          <span className="line-clamp-4 font-semibold break-words" style={{ fontSize: Math.max(9, width / 8) }}>
            {film.name}
          </span>
          {film.year && <span className="text-muted" style={{ fontSize: Math.max(8, width / 10) }}>{film.year}</span>}
        </div>
      )}
      {showRating && strip != null && (
        <span className="absolute inset-x-0 bottom-0 bg-black/75 text-center leading-snug text-lb-green" style={{ fontSize: Math.max(9, width / 9) }}>
          {strip}
        </span>
      )}
    </div>
  )
}

interface ItemProps {
  film: Film
  match: Match | undefined
  options: CardOptions
}

/** Card inside a tier row: sortable within and across tiers. */
export const SortablePoster = memo(function SortablePoster({ film, match, options }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: film.id })
  const { onClick, selectedId, ...cardOptions } = options
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-film-id={film.id}
      data-selected={selectedId === film.id || undefined}
      className={`cursor-grab touch-manipulation rounded-[3px] active:cursor-grabbing ${isDragging ? 'opacity-30' : ''} ${selectedId === film.id ? 'ring-2 ring-lb-blue ring-offset-1 ring-offset-ink' : ''}`}
      onClick={() => onClick?.(film)}
      {...attributes}
      {...listeners}
    >
      <PosterCard film={film} match={match} {...cardOptions} />
    </div>
  )
})

/** Card in the unplaced pool: draggable only, since the pool's order comes from its sort setting. */
export const PoolPoster = memo(function PoolPoster({ film, match, options }: ItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: film.id })
  const { onClick, selectedId, ...cardOptions } = options
  return (
    <div
      ref={setNodeRef}
      data-film-id={film.id}
      data-selected={selectedId === film.id || undefined}
      className={`cursor-grab touch-manipulation rounded-[3px] active:cursor-grabbing ${isDragging ? 'opacity-30' : ''} ${selectedId === film.id ? 'ring-2 ring-lb-blue ring-offset-1 ring-offset-ink' : ''}`}
      onClick={() => onClick?.(film)}
      {...attributes}
      {...listeners}
    >
      <PosterCard film={film} match={match} {...cardOptions} />
    </div>
  )
})
