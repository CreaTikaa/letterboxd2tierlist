import { useMemo, useRef, useState } from 'react'
import { useVisibleFilms } from '../hooks'
import { errorMessage, useT } from '../i18n'
import { Trans } from '../i18n/Trans'
import { dateStamp, downloadBlob } from '../lib/download'
import { renderTierListPng, type TierRowData } from '../lib/export/png'
import { createSaveFile } from '../lib/export/saveFile'
import { TIERMAKER_TEMPLATE_LIMIT, buildTierMakerZip, type Caption } from '../lib/export/tiermaker'
import { sortFilms } from '../lib/filter'
import { placedIds } from '../lib/tiers'
import type { Film } from '../lib/types'
import { importFromFiles } from '../store/importFromFiles'
import { sharedListFromBoard } from '../lib/share'
import { useStore } from '../store/useStore'
import { ShareLinkButton } from './ShareLinkButton'
import { Button, Dialog, ProgressBar, Section, inputClass } from './ui'

type Scope = 'visible' | 'board' | 'pool'

interface Progress {
  done: number
  total: number
}

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const films = useStore((s) => s.films)
  const matches = useStore((s) => s.matches)
  const tiers = useStore((s) => s.tiers)
  const ratingMap = useStore((s) => s.ratingMap)
  const filters = useStore((s) => s.filters)
  const poolSort = useStore((s) => s.poolSort)
  const notify = useStore((s) => s.notify)
  const visible = useVisibleFilms()
  const loadInput = useRef<HTMLInputElement>(null)
  const t = useT()

  // Until edited, the title follows the language.
  const [customTitle, setTitle] = useState<string | null>(null)
  const title = customTitle ?? t('export.defaultTitle')
  const [columns, setColumns] = useState(10)
  const [includeUnplaced, setIncludeUnplaced] = useState(false)
  const [scope, setScope] = useState<Scope>('visible')
  const [caption, setCaption] = useState<Caption>('none')
  const [pngProgress, setPngProgress] = useState<Progress | null>(null)
  const [zipProgress, setZipProgress] = useState<Progress | null>(null)

  const { rows, pool, onBoard } = useMemo(() => {
    const byId = new Map(visible.map((f) => [f.id, f]))
    const placed = placedIds(tiers)
    const rows: TierRowData[] = tiers.map((tier) => ({ tier, films: tier.filmIds.map((id) => byId.get(id)).filter((f): f is Film => Boolean(f)) }))
    return {
      rows,
      pool: sortFilms(visible.filter((f) => !placed.has(f.id)), poolSort),
      onBoard: rows.flatMap((row) => row.films),
    }
  }, [visible, tiers, poolSort])

  const scoped: Record<Scope, Film[]> = { visible: sortFilms(visible, 'rating'), board: onBoard, pool }
  const packFilms = scoped[scope]

  const exportPng = async () => {
    setPngProgress({ done: 0, total: 1 })
    try {
      const unplacedRow: TierRowData = { tier: { id: 'unplaced', label: t('export.unplacedRow'), color: '#445566', filmIds: [] }, films: pool }
      const options = { columns, title, footer: t('common.pngFooter') }
      const blob = await renderTierListPng(includeUnplaced && pool.length ? [...rows, unplacedRow] : rows, matches, options, (done, total) =>
        setPngProgress({ done, total }),
      )
      downloadBlob(blob, `tierlist-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: t('common.pngFailed', { message: errorMessage(t, error) }) })
    } finally {
      setPngProgress(null)
    }
  }

  const exportZip = async () => {
    setZipProgress({ done: 0, total: packFilms.length })
    try {
      const texts = { readme: t('pack.readme'), unrated: t('common.unrated') }
      const { blob, fileCount, batchCount } = await buildTierMakerZip(packFilms, matches, caption, texts, (done, total) => setZipProgress({ done, total }))
      downloadBlob(blob, `tiermaker-posters-${dateStamp()}.zip`)
      notify({
        kind: 'success',
        text: batchCount > 1 ? t('export.zipDoneBatches', { count: fileCount, batches: batchCount }) : t('export.zipDone', { count: fileCount }),
      })
    } catch (error) {
      notify({ kind: 'error', text: t('export.zipFailed', { message: errorMessage(t, error) }) })
    } finally {
      setZipProgress(null)
    }
  }

  const exportSave = () => {
    const save = createSaveFile({ films, matches, tiers, ratingMap, filters })
    downloadBlob(new Blob([JSON.stringify(save)], { type: 'application/json' }), `letterboxd2tierlist-${dateStamp()}.json`)
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('export.title')}>
      <Section title={t('export.pngTitle')}>
        <p className="text-sm text-muted">
          {t('export.pngHelp', { films: t('common.films', { count: onBoard.length }), tiers: t('export.tiers', { count: tiers.length }) })}
        </p>
        <div className="grid gap-3 text-sm sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1 text-muted">
            {t('export.imageTitle')}
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            {t('export.columns')}
            <input type="number" min={4} max={30} value={columns} onChange={(e) => setColumns(Math.min(30, Math.max(4, Number(e.target.value) || 10)))} className={`${inputClass} w-24`} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={includeUnplaced} onChange={(e) => setIncludeUnplaced(e.target.checked)} className="accent-lb-green" />
          {t('export.includeUnplaced', { count: pool.length })}
        </label>
        <ShareLinkButton build={() => sharedListFromBoard(title, tiers, onBoard, matches)} label={t('share.copyReadOnly')} />
        {pngProgress ? (
          <ProgressBar value={pngProgress.done} max={pngProgress.total} />
        ) : (
          <Button variant="primary" onClick={() => void exportPng()} disabled={onBoard.length === 0 && !(includeUnplaced && pool.length)}>
            {t('common.downloadPng')}
          </Button>
        )}
      </Section>

      <Section title={t('export.packTitle')}>
        <p className="text-sm text-muted">
          <Trans
            k="export.packHelp"
            tags={{
              link: (text) => (
                <a href="https://tiermaker.com/create" target="_blank" rel="noreferrer" className="text-lb-blue hover:underline">
                  {text}
                </a>
              ),
            }}
          />
        </p>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-muted">
            {t('export.packFilms')}
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className={inputClass}>
              <option value="visible">{t('export.scopeVisible', { count: scoped.visible.length })}</option>
              <option value="board">{t('export.scopeBoard', { count: scoped.board.length })}</option>
              <option value="pool">{t('export.scopePool', { count: scoped.pool.length })}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-muted">
            {t('export.caption')}
            <select value={caption} onChange={(e) => setCaption(e.target.value as Caption)} className={inputClass}>
              <option value="none">{t('export.captionNone')}</option>
              <option value="title">{t('export.captionTitle')}</option>
              <option value="title-rating">{t('export.captionTitleRating')}</option>
            </select>
          </label>
        </div>
        {packFilms.length > TIERMAKER_TEMPLATE_LIMIT && (
          <p className="text-sm text-lb-orange">
            {t('export.packLimit', { limit: TIERMAKER_TEMPLATE_LIMIT })}
          </p>
        )}
        {zipProgress ? (
          <div className="space-y-1">
            <ProgressBar value={zipProgress.done} max={zipProgress.total} />
            <p className="text-xs text-muted">
              {t('export.preparing', { done: zipProgress.done, total: zipProgress.total })}
            </p>
          </div>
        ) : (
          <Button variant="primary" onClick={() => void exportZip()} disabled={packFilms.length === 0}>
            {t('export.downloadZip', { count: packFilms.length })}
          </Button>
        )}
      </Section>

      <Section title={t('export.saveTitle')}>
        <p className="text-sm text-muted">{t('export.saveHelp')}</p>
        <div className="flex gap-2">
          <Button onClick={exportSave}>{t('export.downloadSave')}</Button>
          <Button variant="ghost" onClick={() => loadInput.current?.click()}>
            {t('export.loadSave')}
          </Button>
          <input
            ref={loadInput}
            type="file"
            accept=".json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file && (await importFromFiles([file]))) onClose()
            }}
          />
        </div>
      </Section>
    </Dialog>
  )
}
