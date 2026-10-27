import { useMemo, useRef, useState } from 'react'
import { useVisibleFilms } from '../hooks'
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

  const [title, setTitle] = useState('My Letterboxd tier list')
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
      const unplacedRow: TierRowData = { tier: { id: 'unplaced', label: 'Unplaced', color: '#445566', filmIds: [] }, films: pool }
      const blob = await renderTierListPng(includeUnplaced && pool.length ? [...rows, unplacedRow] : rows, matches, { columns, title }, (done, total) =>
        setPngProgress({ done, total }),
      )
      downloadBlob(blob, `tierlist-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: `PNG export failed: ${error instanceof Error ? error.message : error}` })
    } finally {
      setPngProgress(null)
    }
  }

  const exportZip = async () => {
    setZipProgress({ done: 0, total: packFilms.length })
    try {
      const { blob, fileCount, batchCount } = await buildTierMakerZip(packFilms, matches, caption, (done, total) => setZipProgress({ done, total }))
      downloadBlob(blob, `tiermaker-posters-${dateStamp()}.zip`)
      notify({ kind: 'success', text: `Exported ${fileCount} posters${batchCount > 1 ? ` in ${batchCount} upload batches` : ''}.` })
    } catch (error) {
      notify({ kind: 'error', text: `ZIP export failed: ${error instanceof Error ? error.message : error}` })
    } finally {
      setZipProgress(null)
    }
  }

  const exportSave = () => {
    const save = createSaveFile({ films, matches, tiers, ratingMap, filters })
    downloadBlob(new Blob([JSON.stringify(save)], { type: 'application/json' }), `letterboxd2tierlist-${dateStamp()}.json`)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Export">
      <Section title="Tier list image (PNG)">
        <p className="text-sm text-muted">
          Renders the board as it is now: {onBoard.length} films in {tiers.length} tiers.
        </p>
        <div className="grid gap-3 text-sm sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1 text-muted">
            Title (optional)
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            Posters per row
            <input type="number" min={4} max={30} value={columns} onChange={(e) => setColumns(Math.min(30, Math.max(4, Number(e.target.value) || 10)))} className={`${inputClass} w-24`} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={includeUnplaced} onChange={(e) => setIncludeUnplaced(e.target.checked)} className="accent-lb-green" />
          Add unplaced films as a last row ({pool.length})
        </label>
        <ShareLinkButton build={() => sharedListFromBoard(title, tiers, onBoard, matches)} label="Copy share link (read-only)" />
        {pngProgress ? (
          <ProgressBar value={pngProgress.done} max={pngProgress.total} />
        ) : (
          <Button variant="primary" onClick={() => void exportPng()} disabled={onBoard.length === 0 && !(includeUnplaced && pool.length)}>
            Download PNG
          </Button>
        )}
      </Section>

      <Section title="TierMaker poster pack (ZIP)">
        <p className="text-sm text-muted">
          One image per film, named “Title (Year)”, ready to upload as a{' '}
          <a href="https://tiermaker.com/create" target="_blank" rel="noreferrer" className="text-lb-blue hover:underline">
            TierMaker template
          </a>
          . Packs over 500 images are split into batch folders, because TierMaker takes 500 images per upload.
        </p>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-muted">
            Films
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className={inputClass}>
              <option value="visible">All films matching filters ({scoped.visible.length})</option>
              <option value="board">Films on the board ({scoped.board.length})</option>
              <option value="pool">Unplaced films ({scoped.pool.length})</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-muted">
            Text on posters
            <select value={caption} onChange={(e) => setCaption(e.target.value as Caption)} className={inputClass}>
              <option value="none">None (original posters)</option>
              <option value="title">Title</option>
              <option value="title-rating">Title + my rating</option>
            </select>
          </label>
        </div>
        {packFilms.length > TIERMAKER_TEMPLATE_LIMIT && (
          <p className="text-sm text-lb-orange">
            TierMaker templates hold at most {TIERMAKER_TEMPLATE_LIMIT.toLocaleString()} images. Narrow the filters to fit.
          </p>
        )}
        {zipProgress ? (
          <div className="space-y-1">
            <ProgressBar value={zipProgress.done} max={zipProgress.total} />
            <p className="text-xs text-muted">
              Preparing posters… {zipProgress.done} / {zipProgress.total}
            </p>
          </div>
        ) : (
          <Button variant="primary" onClick={() => void exportZip()} disabled={packFilms.length === 0}>
            Download ZIP ({packFilms.length} posters)
          </Button>
        )}
      </Section>

      <Section title="Save file">
        <p className="text-sm text-muted">Back up your board and poster matches, or move them to another browser.</p>
        <div className="flex gap-2">
          <Button onClick={exportSave}>Download save (.json)</Button>
          <Button variant="ghost" onClick={() => loadInput.current?.click()}>
            Load save…
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
