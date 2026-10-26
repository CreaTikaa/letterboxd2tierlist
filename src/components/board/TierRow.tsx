import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { textColorFor } from '../../lib/export/canvas'
import type { Film, Match, Tier } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { SortablePoster } from './PosterCard'

interface Props {
  tier: Tier
  filmIds: string[]
  filmById: Map<string, Film>
  matches: Record<string, Match>
  isFirst: boolean
  isLast: boolean
}

const iconButton = 'rounded px-1.5 py-0.5 text-muted hover:bg-raised hover:text-text disabled:opacity-30 disabled:hover:bg-transparent'

export function TierRow({ tier, filmIds, filmById, matches, isFirst, isLast }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id })
  const cardWidth = useStore((s) => s.cardWidth)
  const showRatings = useStore((s) => s.showRatings)
  const updateTier = useStore((s) => s.updateTier)
  const moveTier = useStore((s) => s.moveTier)
  const removeTier = useStore((s) => s.removeTier)
  const minHeight = Math.round(cardWidth * 1.5)

  return (
    <div className="group flex border-b border-black last:border-b-0">
      <div className="flex w-24 shrink-0 items-center justify-center p-1 sm:w-32" style={{ background: tier.color, minHeight }}>
        <textarea
          value={tier.label}
          onChange={(e) => updateTier(tier.id, { label: e.target.value })}
          rows={1}
          aria-label="Tier name"
          className="field-sizing-content w-full resize-none bg-transparent text-center text-lg leading-tight font-semibold outline-none focus:bg-black/10 sm:text-xl"
          style={{ color: textColorFor(tier.color) }}
        />
      </div>

      <SortableContext id={tier.id} items={filmIds} strategy={rectSortingStrategy}>
        <div ref={setNodeRef} className={`flex flex-1 flex-wrap content-start gap-0.5 p-0.5 ${isOver ? 'bg-white/5' : ''}`} style={{ minHeight }}>
          {filmIds.map((id) => {
            const film = filmById.get(id)
            return film ? <SortablePoster key={id} film={film} match={matches[id]} width={cardWidth} showRating={showRatings} /> : null
          })}
        </div>
      </SortableContext>

      <div className="flex w-9 shrink-0 flex-col items-center justify-center gap-0.5 bg-panel text-xs opacity-60 transition group-hover:opacity-100">
        <button type="button" className={iconButton} disabled={isFirst} onClick={() => moveTier(tier.id, -1)} aria-label="Move tier up" title="Move up">
          ▲
        </button>
        <label className="flex size-6 items-center justify-center" title="Tier colour">
          <input type="color" value={tier.color} onChange={(e) => updateTier(tier.id, { color: e.target.value })} className="size-4" aria-label="Tier colour" />
        </label>
        <button
          type="button"
          className={iconButton}
          onClick={() => {
            if (!tier.filmIds.length || confirm(`Delete tier "${tier.label}"? Its ${tier.filmIds.length} films go back to the pool.`)) removeTier(tier.id)
          }}
          aria-label="Delete tier"
          title="Delete tier"
        >
          ✕
        </button>
        <button type="button" className={iconButton} disabled={isLast} onClick={() => moveTier(tier.id, 1)} aria-label="Move tier down" title="Move down">
          ▼
        </button>
      </div>
    </div>
  )
}
