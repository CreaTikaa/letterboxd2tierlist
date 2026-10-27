import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { useT, type TKey } from '../../i18n'
import type { Film, Match, PoolSort } from '../../lib/types'
import { Button, inputClass } from '../ui'
import { PoolPoster, type CardOptions } from './PosterCard'

export const POOL_ID = 'pool'

/** Rendering thousands of draggable posters makes every drag sluggish, so big pools show a page at a time. */
const PAGE = 300

const SORT_LABELS: Record<PoolSort, TKey> = {
  rating: 'pool.sortRating',
  watched: 'pool.sortWatched',
  year: 'pool.sortYear',
  title: 'pool.sortTitle',
}

interface Props {
  filmIds: string[]
  filmById: Map<string, Film>
  matches: Record<string, Match>
  cardOptions: CardOptions
  poolSort: PoolSort
  onPoolSortChange: (sort: PoolSort) => void
  onAreaClick?: () => void
}

export function Pool({ filmIds, filmById, matches, cardOptions, poolSort, onPoolSortChange, onAreaClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID })
  const [limit, setLimit] = useState(PAGE)
  const t = useT()
  const shown = filmIds.slice(0, limit)
  // The selected film (e.g. picked with "Find a film") shows even when it's past the current page.
  const selected = cardOptions.selectedId
  if (selected && filmIds.indexOf(selected) >= limit) shown.push(selected)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          {t('pool.title')} <span className="font-normal text-muted">({filmIds.length})</span>
        </h2>
        <label className="flex items-center gap-2 text-sm text-muted">
          {t('pool.sort')}
          <select value={poolSort} onChange={(e) => onPoolSortChange(e.target.value as PoolSort)} className={inputClass}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        ref={setNodeRef}
        data-pool
        onClick={(e) => e.target === e.currentTarget && onAreaClick?.()}
        className={`flex min-h-32 flex-wrap content-start gap-0.5 rounded-lg border border-dashed p-1 transition ${isOver ? 'border-lb-green bg-lb-green/5' : 'border-line'} ${onAreaClick ? 'cursor-pointer' : ''}`}
      >
        {filmIds.length === 0 && <p className="m-auto p-6 text-sm text-muted">{t('pool.empty')}</p>}
        {shown.map((id) => {
          const film = filmById.get(id)
          return film ? <PoolPoster key={id} film={film} match={matches[id]} options={cardOptions} /> : null
        })}
      </div>
      {filmIds.length > limit && (
        <div className="flex justify-center gap-2">
          <Button variant="ghost" onClick={() => setLimit(limit + PAGE)}>
            {t('pool.showMore', { count: Math.min(PAGE, filmIds.length - limit) })}
          </Button>
          <Button variant="ghost" onClick={() => setLimit(filmIds.length)}>
            {t('pool.showAll', { count: filmIds.length })}
          </Button>
        </div>
      )}
    </div>
  )
}
