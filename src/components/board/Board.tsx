import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isTyping, type History } from '../../hooks/useHistory'
import { sortFilms } from '../../lib/filter'
import { addTier, clearTiers, moveFilmTo, moveTier, placedIds, removeTier, updateTier } from '../../lib/tiers'
import type { Film, Match, PoolSort, Tier } from '../../lib/types'
import { useT } from '../../i18n'
import { useStore } from '../../store/useStore'
import { Button } from '../ui'
import { POOL_ID, Pool } from './Pool'
import { PosterCard, type CardOptions } from './PosterCard'
import { TierRow } from './TierRow'

/** Visible film ids per container (each tier id, plus the pool). */
type Containers = Record<string, string[]>

function findContainer(containers: Containers, id: string): string | undefined {
  if (id in containers) return id
  return Object.keys(containers).find((key) => containers[key].includes(id))
}

/** Prefers whatever is under the pointer (works best with wrapped rows), else the nearest item. */
function makeCollisionDetection(containerIds: Set<string>): CollisionDetection {
  return (args) => {
    const hits = pointerWithin(args)
    if (hits.length === 0) return closestCenter(args)
    // A card under the pointer beats the row it sits in.
    const card = hits.find((hit) => !containerIds.has(String(hit.id)))
    return card ? [card] : hits
  }
}

export interface BoardProps {
  tiers: Tier[]
  /** Films that pass the current filters; only these are shown. */
  films: Film[]
  matches: Record<string, Match>
  /** `coalesce` groups rapid edits (typing a tier name) into one undo step. */
  onTiersChange: (tiers: Tier[], coalesce?: string) => void
  /** Undo/redo for this board (buttons; the keyboard shortcuts come from the hook). */
  history?: Pick<History<Tier[]>, 'undo' | 'redo' | 'canUndo' | 'canRedo'>
  poolSort: PoolSort
  onPoolSortChange: (sort: PoolSort) => void
  onAutoFill?: () => void
  onFilmClick?: (film: Film) => void
  badge?: CardOptions['badge']
  /** Extra toolbar buttons, shown after the built-in ones. */
  toolbar?: ReactNode
  hint?: string
}

export function Board({ tiers, films, matches, onTiersChange, history, poolSort, onPoolSortChange, onAutoFill, onFilmClick, badge, toolbar, hint }: BoardProps) {
  const cardWidth = useStore((s) => s.cardWidth)
  const showRatings = useStore((s) => s.showRatings)
  const t = useT()
  // Tap/click a poster to select it, then a tier (or a number key) to send it there.
  const [rawSelectedId, setSelectedId] = useState<string | null>(null)
  const toggleSelect = useCallback((film: Film) => setSelectedId((id) => (id === film.id ? null : film.id)), [])
  // A selected film that gets filtered out or removed simply stops being selected.
  const selectedId = rawSelectedId && films.some((f) => f.id === rawSelectedId) ? rawSelectedId : null
  const cardOptions = useMemo<CardOptions>(
    () => ({ width: cardWidth, showRating: showRatings, badge, onClick: toggleSelect, selectedId }),
    [cardWidth, showRatings, badge, toggleSelect, selectedId],
  )

  const filmById = useMemo(() => new Map(films.map((f) => [f.id, f])), [films])
  const visibleIds = useMemo(() => new Set(films.map((f) => f.id)), [films])

  const derived = useMemo<Containers>(() => {
    const placed = placedIds(tiers)
    const containers: Containers = {}
    for (const tier of tiers) containers[tier.id] = tier.filmIds.filter((id) => visibleIds.has(id))
    containers[POOL_ID] = sortFilms(
      films.filter((f) => !placed.has(f.id)),
      poolSort,
    ).map((f) => f.id)
    return containers
  }, [tiers, films, visibleIds, poolSort])

  // While dragging, cross-container moves happen on this local copy; it's committed on drop.
  const [dragItems, setDragItems] = useState<Containers | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const items = dragItems ?? derived

  const collisionDetection = useMemo(() => makeCollisionDetection(new Set([POOL_ID, ...tiers.map((t) => t.id)])), [tiers])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const commit = (containers: Containers) => {
    onTiersChange(
      tiers.map((tier) => ({
        ...tier,
        // Films hidden by the current filters keep their spot at the end of the tier.
        filmIds: [...(containers[tier.id] ?? []), ...tier.filmIds.filter((id) => !visibleIds.has(id))],
      })),
    )
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setDragItems(derived)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    setDragItems((prev) => {
      const containers = prev ?? derived
      const from = findContainer(containers, activeKey)
      const to = findContainer(containers, overKey)
      if (!from || !to || from === to) return prev
      const target = containers[to]
      let index = target.length
      if (!(overKey in containers)) {
        const overIndex = target.indexOf(overKey)
        const translated = active.rect.current.translated
        const pastMiddle = translated && translated.left > over.rect.left + over.rect.width / 2
        index = overIndex + (pastMiddle ? 1 : 0)
      }
      return {
        ...containers,
        [from]: containers[from].filter((id) => id !== activeKey),
        [to]: [...target.slice(0, index), activeKey, ...target.slice(index)],
      }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    let containers = dragItems ?? derived
    if (over) {
      const activeKey = String(active.id)
      const overKey = String(over.id)
      const from = findContainer(containers, activeKey)
      const to = findContainer(containers, overKey)
      if (from && from === to && to !== POOL_ID) {
        const oldIndex = containers[to].indexOf(activeKey)
        const newIndex = containers[to].indexOf(overKey)
        if (newIndex >= 0 && oldIndex !== newIndex) containers = { ...containers, [to]: arrayMove(containers[to], oldIndex, newIndex) }
      }
      commit(containers)
    }
    setDragItems(null)
    setActiveId(null)
  }

  const onDragCancel = () => {
    setDragItems(null)
    setActiveId(null)
  }

  const activeFilm = activeId ? filmById.get(activeId) : undefined
  const placedCount = tiers.reduce((sum, tier) => sum + (items[tier.id]?.length ?? 0), 0)
  const selected = selectedId ? filmById.get(selectedId) : undefined

  /** Sends the selected film to a tier (null = back to the pool). From the pool, the next unplaced film gets selected. */
  const place = useCallback(
    (tierId: string | null) => {
      if (!selectedId) return
      const pool = derived[POOL_ID]
      const fromPool = pool.indexOf(selectedId)
      onTiersChange(moveFilmTo(tiers, selectedId, tierId))
      const next = fromPool >= 0 && tierId ? pool.filter((id) => id !== selectedId)[fromPool] : undefined
      setSelectedId(next ?? null)
    },
    [selectedId, derived, tiers, onTiersChange],
  )

  // Keyboard: 1–9 = tier, 0 = pool, Enter = details, Esc = deselect.
  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') setSelectedId(null)
      else if (e.key === '0') place(null)
      else if (/^[1-9]$/.test(e.key) && tiers[Number(e.key) - 1]) place(tiers[Number(e.key) - 1].id)
      else if (e.key === 'Enter' && selected) onFilmClick?.(selected)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, selected, tiers, place, onFilmClick])

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {onAutoFill && (
            <Button variant="primary" onClick={onAutoFill} title={t('board.autoFillTitle')}>
              {t('board.autoFill')}
            </Button>
          )}
          <Button onClick={() => onTiersChange(addTier(tiers, t('common.newTier')))}>{t('board.addTier')}</Button>
          <Button variant="ghost" disabled={placedCount === 0} onClick={() => confirm(t('board.clearConfirm')) && onTiersChange(clearTiers(tiers))}>
            {t('board.clear')}
          </Button>
          {history && (
            <span className="flex">
              <Button variant="ghost" disabled={!history.canUndo} onClick={history.undo} title={t('board.undo')} aria-label={t('board.undo')}>
                ↶
              </Button>
              <Button variant="ghost" disabled={!history.canRedo} onClick={history.redo} title={t('board.redo')} aria-label={t('board.redo')}>
                ↷
              </Button>
            </span>
          )}
          {toolbar}
          <span className="ml-auto text-xs text-muted">{hint ?? t('board.hint')}</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-black bg-[#1a1a17]">
          {tiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              filmIds={items[tier.id] ?? []}
              filmById={filmById}
              matches={matches}
              cardOptions={cardOptions}
              isFirst={i === 0}
              isLast={i === tiers.length - 1}
              onUpdate={(changes) => onTiersChange(updateTier(tiers, tier.id, changes), `edit:${tier.id}:${Object.keys(changes).join()}`)}
              onAreaClick={selectedId ? () => place(tier.id) : undefined}
              onMove={(offset) => onTiersChange(moveTier(tiers, tier.id, offset))}
              onRemove={() => onTiersChange(removeTier(tiers, tier.id))}
            />
          ))}
          {tiers.length === 0 && <p className="p-6 text-center text-sm text-muted">{t('board.noTiers')}</p>}
        </div>

        <Pool
          filmIds={items[POOL_ID]}
          filmById={filmById}
          matches={matches}
          cardOptions={cardOptions}
          poolSort={poolSort}
          onPoolSortChange={onPoolSortChange}
          onAreaClick={selectedId ? () => place(null) : undefined}
        />
      </div>

      {selected && (
        <div className="fixed inset-x-2 bottom-3 z-30 flex justify-center" role="toolbar" aria-label={t('board.moveTo', { film: selected.name })}>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-xl border border-line bg-panel/95 p-2 shadow-2xl backdrop-blur">
            <span className="max-w-40 truncate px-1 text-sm font-semibold" title={selected.name}>
              {selected.name}
            </span>
            {tiers.map((tier, i) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => place(tier.id)}
                title={`${tier.label} (${i + 1})`}
                className="min-w-9 rounded-md px-2 py-1.5 text-sm font-bold text-ink hover:brightness-110"
                style={{ background: tier.color }}
              >
                {tier.label || i + 1}
              </button>
            ))}
            <Button variant="secondary" className="!px-2" onClick={() => place(null)} title={`${t('board.unplace')} (0)`}>
              {t('board.unplace')}
            </Button>
            {onFilmClick && (
              <Button variant="ghost" className="!px-2" onClick={() => onFilmClick(selected)} title={`${t('board.details')} (Enter)`}>
                {t('board.details')}
              </Button>
            )}
            <Button variant="ghost" className="!px-2" onClick={() => setSelectedId(null)} aria-label={t('common.close')} title={`${t('common.close')} (Esc)`}>
              ✕
            </Button>
          </div>
        </div>
      )}

      <DragOverlay dropAnimation={null}>
        {activeFilm && <PosterCard film={activeFilm} match={matches[activeFilm.id]} width={cardWidth} showRating={showRatings} badge={badge} lifted />}
      </DragOverlay>
    </DndContext>
  )
}
