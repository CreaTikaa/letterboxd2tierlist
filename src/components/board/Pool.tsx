import { useDroppable } from '@dnd-kit/core'
import type { Film, Match, PoolSort } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { inputClass } from '../ui'
import { PoolPoster } from './PosterCard'

export const POOL_ID = 'pool'

const SORT_LABELS: Record<PoolSort, string> = {
  rating: 'Highest rated',
  watched: 'Recently watched',
  year: 'Newest release',
  title: 'Title A–Z',
}

export function Pool({ filmIds, filmById, matches }: { filmIds: string[]; filmById: Map<string, Film>; matches: Record<string, Match> }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID })
  const cardWidth = useStore((s) => s.cardWidth)
  const showRatings = useStore((s) => s.showRatings)
  const poolSort = useStore((s) => s.poolSort)
  const setPoolSort = useStore((s) => s.setPoolSort)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          Unplaced <span className="font-normal text-muted">({filmIds.length})</span>
        </h2>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select value={poolSort} onChange={(e) => setPoolSort(e.target.value as PoolSort)} className={inputClass}>
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
        className={`flex min-h-32 flex-wrap content-start gap-0.5 rounded-lg border border-dashed p-1 transition ${isOver ? 'border-lb-green bg-lb-green/5' : 'border-line'}`}
      >
        {filmIds.length === 0 && <p className="m-auto p-6 text-sm text-muted">Every film is on the board. Drag one here to take it off.</p>}
        {filmIds.map((id) => {
          const film = filmById.get(id)
          return film ? <PoolPoster key={id} film={film} match={matches[id]} width={cardWidth} showRating={showRatings} /> : null
        })}
      </div>
    </div>
  )
}
