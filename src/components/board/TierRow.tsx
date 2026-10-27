import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useT } from '../../i18n'
import { textColorFor } from '../../lib/export/canvas'
import type { Film, Match, Tier } from '../../lib/types'
import { SortablePoster, type CardOptions } from './PosterCard'

interface Props {
  tier: Tier
  filmIds: string[]
  filmById: Map<string, Film>
  matches: Record<string, Match>
  cardOptions: CardOptions
  isFirst: boolean
  isLast: boolean
  onUpdate: (changes: Partial<Omit<Tier, 'id'>>) => void
  onMove: (offset: -1 | 1) => void
  onRemove: () => void
  /** Clicking the row's empty space (used to drop the selected film here). */
  onAreaClick?: () => void
}

const iconButton = 'rounded px-1.5 py-0.5 text-muted hover:bg-raised hover:text-text disabled:opacity-30 disabled:hover:bg-transparent'

export function TierRow({ tier, filmIds, filmById, matches, cardOptions, isFirst, isLast, onUpdate, onMove, onRemove, onAreaClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id })
  const t = useT()
  const minHeight = Math.round(cardOptions.width * 1.5)

  return (
    <div className="group flex border-b border-black last:border-b-0" data-tier={tier.id}>
      <div className="flex w-20 shrink-0 items-center justify-center p-1 sm:w-32" style={{ background: tier.color, minHeight }}>
        <textarea
          value={tier.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          rows={1}
          aria-label={t('board.tierName')}
          className="field-sizing-content w-full resize-none bg-transparent text-center text-lg leading-tight font-semibold outline-none focus:bg-black/10 sm:text-xl"
          style={{ color: textColorFor(tier.color) }}
        />
      </div>

      <SortableContext id={tier.id} items={filmIds} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          onClick={(e) => e.target === e.currentTarget && onAreaClick?.()}
          className={`flex flex-1 flex-wrap content-start gap-0.5 p-0.5 ${isOver ? 'bg-white/5' : ''} ${onAreaClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
          style={{ minHeight }}
        >
          {filmIds.map((id) => {
            const film = filmById.get(id)
            return film ? <SortablePoster key={id} film={film} match={matches[id]} options={cardOptions} /> : null
          })}
        </div>
      </SortableContext>

      <div className="flex w-9 shrink-0 flex-col items-center justify-center gap-0.5 bg-panel text-xs opacity-60 transition group-hover:opacity-100">
        <button type="button" className={iconButton} disabled={isFirst} onClick={() => onMove(-1)} aria-label={t('board.moveTierUp')} title={t('board.moveUp')}>
          ▲
        </button>
        <label className="flex size-6 items-center justify-center" title={t('board.tierColor')}>
          <input type="color" value={tier.color} onChange={(e) => onUpdate({ color: e.target.value })} className="size-4" aria-label={t('board.tierColor')} />
        </label>
        <button
          type="button"
          className={iconButton}
          onClick={() => {
            if (!tier.filmIds.length || confirm(t('board.deleteTierConfirm', { label: tier.label, count: tier.filmIds.length }))) onRemove()
          }}
          aria-label={t('board.deleteTier')}
          title={t('board.deleteTier')}
        >
          ✕
        </button>
        <button type="button" className={iconButton} disabled={isLast} onClick={() => onMove(1)} aria-label={t('board.moveTierDown')} title={t('board.moveDown')}>
          ▼
        </button>
      </div>
    </div>
  )
}
