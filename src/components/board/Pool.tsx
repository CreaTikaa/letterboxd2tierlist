import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import type { Film, Match, PoolSort } from '../../lib/types'
import { Button, inputClass } from '../ui'
import { PoolPoster, type CardOptions } from './PosterCard'

export const POOL_ID = 'pool'

/** Rendering thousands of draggable posters makes every drag sluggish, so big pools show a page at a time. */
const PAGE = 300

const SORT_LABELS: Record<PoolSort, string> = {
  rating: 'Highest rated',
  watched: 'Recently watched',
  year: 'Newest release',
  title: 'Title A–Z',
}

interface Props {
  filmIds: string[]
  filmById: Map<string, Film>
  matches: Record<string, Match>
  cardOptions: CardOptions
  poolSort: PoolSort
  onPoolSortChange: (sort: PoolSort) => void
}

export function Pool({ filmIds, filmById, matches, cardOptions, poolSort, onPoolSortChange }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID })
  const [limit, setLimit] = useState(PAGE)
  const shown = filmIds.slice(0, limit)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          Unplaced <span className="font-normal text-muted">({filmIds.length})</span>
        </h2>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select value={poolSort} onChange={(e) => onPoolSortChange(e.target.value as PoolSort)} className={inputClass}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        ref={setNodeRef}
        data-pool
        className={`flex min-h-32 flex-wrap content-start gap-0.5 rounded-lg border border-dashed p-1 transition ${isOver ? 'border-lb-green bg-lb-green/5' : 'border-line'}`}
      >
        {filmIds.length === 0 && <p className="m-auto p-6 text-sm text-muted">Every film is on the board. Drag one here to take it off.</p>}
        {shown.map((id) => {
          const film = filmById.get(id)
          return film ? <PoolPoster key={id} film={film} match={matches[id]} options={cardOptions} /> : null
        })}
      </div>
      {filmIds.length > shown.length && (
        <div className="flex justify-center gap-2">
          <Button variant="ghost" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, filmIds.length - shown.length)} more
          </Button>
          <Button variant="ghost" onClick={() => setLimit(filmIds.length)}>
            Show all {filmIds.length}
          </Button>
        </div>
      )}
    </div>
  )
}
