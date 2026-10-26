import { useDraggable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo } from 'react'
import { stars } from '../../lib/ratings'
import { posterUrl } from '../../lib/tmdb/client'
import type { Film, Match } from '../../lib/types'
import { useStore } from '../../store/useStore'

interface CardProps {
  film: Film
  match: Match | undefined
  width: number
  showRating: boolean
  lifted?: boolean
}

export function PosterCard({ film, match, width, showRating, lifted = false }: CardProps) {
  const poster = match?.status === 'matched' && match.posterPath ? posterUrl(match.posterPath, width > 92 ? 'w185' : 'w154') : null
  const label = `${film.name}${film.year ? ` (${film.year})` : ''} · ${stars(film.rating)}`

  return (
    <div
      title={label}
      style={{ width, height: Math.round(width * 1.5) }}
      className={`relative shrink-0 overflow-hidden rounded-[3px] bg-raised select-none ${lifted ? 'shadow-2xl ring-2 ring-lb-green' : ''}`}
    >
      {poster ? (
        <img src={poster} alt={label} loading="lazy" draggable={false} className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-0.5 p-1 text-center leading-tight">
          <span className="line-clamp-4 font-semibold break-words" style={{ fontSize: Math.max(9, width / 8) }}>
            {film.name}
          </span>
          {film.year && <span className="text-muted" style={{ fontSize: Math.max(8, width / 10) }}>{film.year}</span>}
        </div>
      )}
      {showRating && film.rating != null && (
        <span
          className="absolute inset-x-0 bottom-0 bg-black/75 text-center leading-snug text-lb-green"
          style={{ fontSize: Math.max(9, width / 9) }}
        >
          {stars(film.rating)}
        </span>
      )}
    </div>
  )
}

interface ItemProps {
  film: Film
  match: Match | undefined
  width: number
  showRating: boolean
}

/** Card inside a tier row: sortable within and across tiers. */
export const SortablePoster = memo(function SortablePoster({ film, ...props }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: film.id })
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`cursor-grab touch-manipulation active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
      onClick={() => setEditingFilm(film.id)}
      {...attributes}
      {...listeners}
    >
      <PosterCard film={film} {...props} />
    </div>
  )
})

/** Card in the unplaced pool: draggable only, since the pool's order comes from its sort setting. */
export const PoolPoster = memo(function PoolPoster({ film, ...props }: ItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: film.id })
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  return (
    <div
      ref={setNodeRef}
      className={`cursor-grab touch-manipulation active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
      onClick={() => setEditingFilm(film.id)}
      {...attributes}
      {...listeners}
    >
      <PosterCard film={film} {...props} />
    </div>
  )
})
