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
import { useMemo, useState } from 'react'
import { useVisibleFilms } from '../../hooks'
import { sortFilms } from '../../lib/filter'
import { placedIds } from '../../lib/tiers'
import { useStore } from '../../store/useStore'
import { Button } from '../ui'
import { POOL_ID, Pool } from './Pool'
import { PosterCard } from './PosterCard'
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

export function Board({ onAutoFill }: { onAutoFill: () => void }) {
  const films = useStore((s) => s.films)
  const matches = useStore((s) => s.matches)
  const tiers = useStore((s) => s.tiers)
  const poolSort = useStore((s) => s.poolSort)
  const cardWidth = useStore((s) => s.cardWidth)
  const showRatings = useStore((s) => s.showRatings)
  const setTiers = useStore((s) => s.setTiers)
  const addTier = useStore((s) => s.addTier)
  const clearBoard = useStore((s) => s.clearBoard)
  const visible = useVisibleFilms()

  const filmById = useMemo(() => new Map(films.map((f) => [f.id, f])), [films])
  const visibleIds = useMemo(() => new Set(visible.map((f) => f.id)), [visible])

  const derived = useMemo<Containers>(() => {
    const placed = placedIds(tiers)
    const containers: Containers = {}
    for (const tier of tiers) containers[tier.id] = tier.filmIds.filter((id) => visibleIds.has(id))
    containers[POOL_ID] = sortFilms(
      visible.filter((f) => !placed.has(f.id)),
      poolSort,
    ).map((f) => f.id)
    return containers
  }, [tiers, visible, visibleIds, poolSort])

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
    setTiers(
      tiers.map((tier) => ({
        ...tier,
        // Films hidden by the current filters keep their spot at the end of the tier.
        filmIds: [...containers[tier.id], ...tier.filmIds.filter((id) => !visibleIds.has(id))],
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
  const placedCount = tiers.reduce((sum, tier) => sum + items[tier.id].length, 0)

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={onAutoFill} title="Place every visible film in a tier based on its rating">
            ★ Auto-fill by rating
          </Button>
          <Button onClick={addTier}>+ Add tier</Button>
          <Button
            variant="ghost"
            disabled={placedCount === 0}
            onClick={() => confirm('Move every film back to the unplaced pool?') && clearBoard()}
          >
            Clear board
          </Button>
          <span className="ml-auto text-xs text-muted">Drag posters between tiers · click a poster to fix its match</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-black bg-[#1a1a17]">
          {tiers.map((tier, i) => (
            <TierRow key={tier.id} tier={tier} filmIds={items[tier.id]} filmById={filmById} matches={matches} isFirst={i === 0} isLast={i === tiers.length - 1} />
          ))}
          {tiers.length === 0 && <p className="p-6 text-center text-sm text-muted">No tiers yet. Add one to start ranking.</p>}
        </div>

        <Pool filmIds={items[POOL_ID]} filmById={filmById} matches={matches} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeFilm && <PosterCard film={activeFilm} match={matches[activeFilm.id]} width={cardWidth} showRating={showRatings} lifted />}
      </DragOverlay>
    </DndContext>
  )
}
