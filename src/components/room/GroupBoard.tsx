import { useCallback, useEffect, useMemo, useState } from 'react'
import { dateStamp, downloadBlob } from '../../lib/download'
import { renderTierListPng } from '../../lib/export/png'
import { DEFAULT_FILTERS, filterFilms } from '../../lib/filter'
import { groupFilms, type GroupFilm } from '../../lib/room/group'
import { defaultRatingMap } from '../../lib/tiers'
import type { Film, Filters, PoolSort } from '../../lib/types'
import { startEnrichment } from '../../store/enrichment'
import { useRoom } from '../../store/useRoom'
import { useStore } from '../../store/useStore'
import { AutoFillDialog } from '../AutoFillDialog'
import { Board } from '../board/Board'
import { EnrichmentStatus } from '../EnrichmentStatus'
import { FilterBar } from '../FilterBar'
import { sharedListFromBoard } from '../../lib/share'
import { ShareLinkButton } from '../ShareLinkButton'
import { Button, inputClass } from '../ui'

const groupBadge = (film: Film) => {
  const { average, watchers } = film as GroupFilm
  return `${average == null ? '–' : `${average.toFixed(1)}★`} · ${watchers.length}👤`
}

export function GroupBoard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const matches = useStore((s) => s.matches)
  const tmdbKey = useStore((s) => s.tmdbKey)
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const notify = useStore((s) => s.notify)
  const { members, board } = view.state

  const memberList = useMemo(() => Object.values(members), [members])
  const films = useMemo(() => groupFilms(memberList), [memberList])
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS)
  const [minWatchers, setMinWatchers] = useState(1)
  const [poolSort, setPoolSort] = useState<PoolSort>('rating')
  const [ratingMap, setRatingMap] = useState(() => defaultRatingMap(board))
  const [autoFillOpen, setAutoFillOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const eligible = useMemo(() => films.filter((f) => f.watchers.length >= minWatchers), [films, minWatchers])
  const visible = useMemo(() => filterFilms(eligible, filters, matches), [eligible, filters, matches])
  const setFilters = useCallback((changes: Partial<Filters>) => setFiltersState((f) => ({ ...f, ...changes })), [])
  const setBoard = useCallback((tiers: typeof board) => dispatch({ t: 'board', tiers }), [dispatch])
  const openFilm = useCallback((film: Film) => setEditingFilm(film), [setEditingFilm])

  // Whoever has a TMDB key fetches posters; matches are shared with the room automatically.
  useEffect(() => {
    if (tmdbKey && films.length) void startEnrichment(films)
  }, [tmdbKey, films])

  const exportPng = async () => {
    setExporting(true)
    try {
      const byId = new Map(visible.map((f) => [f.id, f]))
      const rows = board.map((tier) => ({ tier, films: tier.filmIds.map((id) => byId.get(id)).filter((f): f is GroupFilm => Boolean(f)) }))
      downloadBlob(await renderTierListPng(rows, matches, { columns: 10, title: `Room ${view.state.id} · group tier list` }), `room-${view.state.id}-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: `PNG export failed: ${error instanceof Error ? error.message : error}` })
    } finally {
      setExporting(false)
    }
  }

  if (films.length === 0) {
    return <p className="rounded-xl bg-panel p-8 text-center text-muted">No films in the room yet. Share yours above and ask your friends to do the same.</p>
  }

  return (
    <div className="space-y-4">
      <EnrichmentStatus
        films={films}
        onOpenSettings={onOpenSettings}
        noKeyMessage="Posters are fetched by anyone in the room who has a TMDB key, and shared with everyone. Add yours to help."
      />
      <FilterBar
        films={eligible}
        filters={filters}
        onChange={setFilters}
        visibleCount={visible.length}
        ratingLabel="Group avg"
        matches={matches}
        extra={
          <label className="flex items-center gap-1.5 text-muted">
            Seen by at least
            <select value={minWatchers} onChange={(e) => setMinWatchers(Number(e.target.value))} className={inputClass}>
              {Array.from({ length: Math.max(1, memberList.length) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === memberList.length && n > 1 ? `${n} (everyone)` : n}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <Board
        tiers={board}
        films={visible}
        matches={matches}
        onTiersChange={setBoard}
        poolSort={poolSort}
        onPoolSortChange={setPoolSort}
        onAutoFill={() => setAutoFillOpen(true)}
        onFilmClick={openFilm}
        badge={groupBadge}
        hint="Everyone in the room edits this board live"
        toolbar={
          <>
            <Button variant="ghost" disabled={exporting} onClick={() => void exportPng()}>
              {exporting ? 'Rendering…' : 'Download PNG'}
            </Button>
            <ShareLinkButton build={() => sharedListFromBoard(`Room ${view.state.id} · group tier list`, board, visible, matches)} label="Share link" />
          </>
        }
      />
      <AutoFillDialog
        open={autoFillOpen}
        onClose={() => setAutoFillOpen(false)}
        tiers={board}
        films={visible}
        ratingMap={ratingMap}
        onRatingMapChange={setRatingMap}
        onApply={setBoard}
        description="Choose the tier for each group average (rounded to the nearest half star). Applying moves every visible film for everyone in the room."
      />
    </div>
  )
}
