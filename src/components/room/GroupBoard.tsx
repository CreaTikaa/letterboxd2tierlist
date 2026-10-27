import { useCallback, useEffect, useMemo, useState } from 'react'
import { errorMessage, useLocale, useT } from '../../i18n'
import { averageText } from '../../lib/ratings'
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

export function GroupBoard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const matches = useStore((s) => s.matches)
  const tmdbKey = useStore((s) => s.tmdbKey)
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const notify = useStore((s) => s.notify)
  const { members, board } = view.state
  const t = useT()
  const locale = useLocale()
  const groupBadge = useCallback(
    (film: Film) => {
      const { average, watchers } = film as GroupFilm
      return t('group.badge', { average: average == null ? '–' : averageText(average, locale), count: watchers.length })
    },
    [t, locale],
  )

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
      const options = { columns: 10, title: t('group.pngTitle', { room: view.state.id }), footer: t('common.pngFooter') }
      downloadBlob(await renderTierListPng(rows, matches, options), `room-${view.state.id}-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: t('common.pngFailed', { message: errorMessage(t, error) }) })
    } finally {
      setExporting(false)
    }
  }

  if (films.length === 0) {
    return <p className="rounded-xl bg-panel p-8 text-center text-muted">{t('group.noFilms')}</p>
  }

  return (
    <div className="space-y-4">
      <EnrichmentStatus
        films={films}
        onOpenSettings={onOpenSettings}
        noKeyMessage={t('group.noKey')}
      />
      <FilterBar
        films={eligible}
        filters={filters}
        onChange={setFilters}
        visibleCount={visible.length}
        ratingLabel={t('filters.groupAverage')}
        matches={matches}
        extra={
          <label className="flex items-center gap-1.5 text-muted">
            {t('group.seenBy')}
            <select value={minWatchers} onChange={(e) => setMinWatchers(Number(e.target.value))} className={inputClass}>
              {Array.from({ length: Math.max(1, memberList.length) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === memberList.length && n > 1 ? t('group.everyoneCount', { count: n }) : n}
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
        hint={t('group.hint')}
        toolbar={
          <>
            <Button variant="ghost" disabled={exporting} onClick={() => void exportPng()}>
              {exporting ? t('common.rendering') : t('common.downloadPng')}
            </Button>
            <ShareLinkButton build={() => sharedListFromBoard(t('group.pngTitle', { room: view.state.id }), board, visible, matches)} label={t('share.short')} />
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
        description={t('autofill.helpGroup')}
      />
    </div>
  )
}
