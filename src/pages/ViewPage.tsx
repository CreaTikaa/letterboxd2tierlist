import { useEffect, useMemo, useState } from 'react'
import { StaticTierList } from '../components/StaticTierList'
import { Button } from '../components/ui'
import { dateStamp, downloadBlob } from '../lib/download'
import { renderTierListPng } from '../lib/export/png'
import { errorMessage, useT } from '../i18n'
import { boardFromSharedList, decodeSharedList, type SharedList } from '../lib/share'
import { useStore } from '../store/useStore'

type State = { status: 'loading' } | { status: 'ready'; list: SharedList } | { status: 'error'; error: unknown }

/** A tier list someone shared as a link (decoded from the URL, read-only). */
export function ViewPage({ code }: { code: string }) {
  const notify = useStore((s) => s.notify)
  const t = useT()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    decodeSharedList(code).then(
      (list) => !cancelled && setState({ status: 'ready', list }),
      (error: unknown) => !cancelled && setState({ status: 'error', error }),
    )
    return () => {
      cancelled = true
    }
  }, [code])

  const board = useMemo(() => (state.status === 'ready' ? boardFromSharedList(state.list) : null), [state])
  const filmById = useMemo(() => new Map(board?.films.map((f) => [f.id, f]) ?? []), [board])

  if (state.status === 'loading') return <p className="py-10 text-center text-muted">{t('view.opening')}</p>
  if (state.status === 'error' || !board) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <p className="text-lg font-semibold">{errorMessage(t, state.status === 'error' ? state.error : null)}</p>
        <a href="#/" className="text-lb-blue hover:underline">
          {t('view.makeYourOwnLink')}
        </a>
      </div>
    )
  }

  const exportPng = async () => {
    setExporting(true)
    try {
      const rows = board.tiers.map((tier) => ({ tier, films: tier.filmIds.map((id) => filmById.get(id)!) }))
      const options = { columns: 10, title: state.list.title, footer: t('common.pngFooter') }
      downloadBlob(await renderTierListPng(rows, board.matches, options), `tierlist-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: t('common.pngFailed', { message: errorMessage(t, error) }) })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{state.list.title || t('view.untitled')}</h1>
          <p className="text-sm text-muted">{t('view.subtitle', { films: t('common.films', { count: board.films.length }) })}</p>
        </div>
        <div className="flex gap-2">
          <Button disabled={exporting} onClick={() => void exportPng()}>
            {exporting ? t('common.rendering') : t('common.downloadPng')}
          </Button>
          <a href="#/" className="inline-flex items-center rounded-md bg-lb-green px-3 py-1.5 text-sm font-semibold text-ink hover:brightness-110">
            {t('view.makeYourOwn')}
          </a>
        </div>
      </div>
      <StaticTierList tiers={board.tiers} filmById={filmById} matches={board.matches} cardWidth={72} large />
    </div>
  )
}
