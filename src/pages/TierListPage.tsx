import { useCallback, useState } from 'react'
import { AutoFillDialog } from '../components/AutoFillDialog'
import { Board } from '../components/board/Board'
import { EnrichmentStatus } from '../components/EnrichmentStatus'
import { FilterBar } from '../components/FilterBar'
import { ImportPanel } from '../components/ImportPanel'
import { useVisibleFilms } from '../hooks'
import type { Film } from '../lib/types'
import { useStore } from '../store/useStore'

export function TierListPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const films = useStore((s) => s.films)
  const matches = useStore((s) => s.matches)
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const tiers = useStore((s) => s.tiers)
  const setTiers = useStore((s) => s.setTiers)
  const ratingMap = useStore((s) => s.ratingMap)
  const setRatingMap = useStore((s) => s.setRatingMap)
  const poolSort = useStore((s) => s.poolSort)
  const setPoolSort = useStore((s) => s.setPoolSort)
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const visible = useVisibleFilms()
  const [autoFillOpen, setAutoFillOpen] = useState(false)
  const openFilm = useCallback((film: Film) => setEditingFilm(film), [setEditingFilm])

  if (films.length === 0) return <ImportPanel />

  return (
    <>
      <EnrichmentStatus onOpenSettings={onOpenSettings} />
      <FilterBar films={films} filters={filters} onChange={setFilters} visibleCount={visible.length} />
      <Board
        tiers={tiers}
        films={visible}
        matches={matches}
        onTiersChange={setTiers}
        poolSort={poolSort}
        onPoolSortChange={setPoolSort}
        onAutoFill={() => setAutoFillOpen(true)}
        onFilmClick={openFilm}
      />
      <AutoFillDialog
        open={autoFillOpen}
        onClose={() => setAutoFillOpen(false)}
        tiers={tiers}
        films={visible}
        ratingMap={ratingMap}
        onRatingMapChange={setRatingMap}
        onApply={setTiers}
      />
    </>
  )
}
