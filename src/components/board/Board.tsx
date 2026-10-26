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
import { useMemo, useState, type ReactNode } from 'react'
import { sortFilms } from '../../lib/filter'
import { addTier, clearTiers, moveTier, placedIds, removeTier, updateTier } from '../../lib/tiers'
import type { Film, Match, PoolSort, Tier } from '../../lib/types'
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
  onTiersChange: (tiers: Tier[]) => void
  poolSort: PoolSort
  onPoolSortChange: (sort: PoolSort) => void
  onAutoFill?: () => void
  onFilmClick?: (film: Film) => void
  badge?: CardOptions['badge']
  /** Extra toolbar buttons, shown after the built-in ones. */
  toolbar?: ReactNode
  hint?: string
}

export function Board({ tiers, films, matches, onTiersChange, poolSort, onPoolSortChange, onAutoFill, onFilmClick, badge, toolbar, hint }: BoardProps) {
  const cardWidth = useStore((s) => s.cardWidth)
  const showRatings = useStore((s) => s.showRatings)
  const cardOptions = useMemo<CardOptions>(() => ({ width: cardWidth, showRating: showRatings, badge, onClick: onFilmClick }), [cardWidth, showRatings, badge, onFilmClick])

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

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {onAutoFill && (
            <Button variant="primary" onClick={onAutoFill} title="Place every visible film in a tier based on its rating">
              ★ Auto-fill by rating
            </Button>
          )}
          <Button onClick={() => onTiersChange(addTier(tiers))}>+ Add tier</Button>
          <Button variant="ghost" disabled={placedCount === 0} onClick={() => confirm('Move every film back to the unplaced pool?') && onTiersChange(clearTiers(tiers))}>
            Clear board
          </Button>
          {toolbar}
          <span className="ml-auto text-xs text-muted">{hint ?? 'Drag posters between tiers · click a poster for details'}</span>
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
              onUpdate={(changes) => onTiersChange(updateTier(tiers, tier.id, changes))}
              onMove={(offset) => onTiersChange(moveTier(tiers, tier.id, offset))}
              onRemove={() => onTiersChange(removeTier(tiers, tier.id))}
            />
          ))}
          {tiers.length === 0 && <p className="p-6 text-center text-sm text-muted">No tiers yet. Add one to start ranking.</p>}
        </div>

        <Pool filmIds={items[POOL_ID]} filmById={filmById} matches={matches} cardOptions={cardOptions} poolSort={poolSort} onPoolSortChange={onPoolSortChange} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeFilm && <PosterCard film={activeFilm} match={matches[activeFilm.id]} width={cardWidth} showRating={showRatings} badge={badge} lifted />}
      </DragOverlay>
    </DndContext>
  )
}
