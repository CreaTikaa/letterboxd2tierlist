import { useEffect, useMemo, useState } from 'react'
import { StaticTierList } from '../components/StaticTierList'
import { Button } from '../components/ui'
import { dateStamp, downloadBlob } from '../lib/download'
import { renderTierListPng } from '../lib/export/png'
import { boardFromSharedList, decodeSharedList, type SharedList } from '../lib/share'
import { useStore } from '../store/useStore'

type State = { status: 'loading' } | { status: 'ready'; list: SharedList } | { status: 'error'; message: string }

/** A tier list someone shared as a link (decoded from the URL, read-only). */
export function ViewPage({ code }: { code: string }) {
  const notify = useStore((s) => s.notify)
  const [state, setState] = useState<State>({ status: 'loading' })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    decodeSharedList(code).then(
      (list) => !cancelled && setState({ status: 'ready', list }),
      (error: Error) => !cancelled && setState({ status: 'error', message: error.message }),
    )
    return () => {
      cancelled = true
    }
  }, [code])

  const board = useMemo(() => (state.status === 'ready' ? boardFromSharedList(state.list) : null), [state])
  const filmById = useMemo(() => new Map(board?.films.map((f) => [f.id, f]) ?? []), [board])

  if (state.status === 'loading') return <p className="py-10 text-center text-muted">Opening tier list…</p>
  if (state.status === 'error' || !board) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <p className="text-lg font-semibold">{state.status === 'error' ? state.message : 'Something went wrong.'}</p>
        <a href="#/" className="text-lb-blue hover:underline">
          Make your own tier list →
        </a>
      </div>
    )
  }

  const exportPng = async () => {
    setExporting(true)
    try {
      const rows = board.tiers.map((tier) => ({ tier, films: tier.filmIds.map((id) => filmById.get(id)!) }))
      downloadBlob(await renderTierListPng(rows, board.matches, { columns: 10, title: state.list.title }), `tierlist-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: `PNG export failed: ${error instanceof Error ? error.message : error}` })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{state.list.title || 'Shared tier list'}</h1>
          <p className="text-sm text-muted">{board.films.length} films · shared with letterboxd2tierlist</p>
        </div>
        <div className="flex gap-2">
          <Button disabled={exporting} onClick={() => void exportPng()}>
            {exporting ? 'Rendering…' : 'Download PNG'}
          </Button>
          <a href="#/" className="inline-flex items-center rounded-md bg-lb-green px-3 py-1.5 text-sm font-semibold text-ink hover:brightness-110">
            Make your own
          </a>
        </div>
      </div>
      <StaticTierList tiers={board.tiers} filmById={filmById} matches={board.matches} cardWidth={72} large />
    </div>
  )
}
