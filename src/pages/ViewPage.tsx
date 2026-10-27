import { useEffect, useMemo, useState } from 'react'
import { RankingList } from '../components/RankingList'
import { StaticTierList } from '../components/StaticTierList'
import { TournamentResults } from '../components/tournament/shared'
import { Button, inputClass } from '../components/ui'
import { errorMessage, useT } from '../i18n'
import { useTournamentText } from '../i18n/tournamentText'
import { dateStamp, downloadBlob } from '../lib/download'
import { renderTierListPng } from '../lib/export/png'
import { renderTournamentPng } from '../lib/export/tournamentPng'
import { boardFromSharedList, decodeShared, rankingFromShared, tournamentFromShared, type SharedItem, type SharedList, type SharedRanking, type SharedTournament } from '../lib/share'
import { navigate } from '../router'
import { useStore } from '../store/useStore'

type State = { status: 'loading' } | { status: 'ready'; item: SharedItem } | { status: 'error'; error: unknown }

/** Extracts the code from a pasted share link (or accepts a bare code). */
function shareCodeFrom(text: string): string | null {
  return text.trim().match(/(?:#\/view\/)?([A-Za-z0-9_-]{10,})\s*$/)?.[1] ?? null
}

/** Something shared as a link: a tier list, a tournament result or a ranking (read-only). */
export function ViewPage({ code }: { code: string }) {
  const t = useT()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    decodeShared(code).then(
      (item) => !cancelled && setState({ status: 'ready', item }),
      (error: unknown) => !cancelled && setState({ status: 'error', error }),
    )
    return () => {
      cancelled = true
    }
  }, [code])

  if (state.status === 'loading') return <p className="py-10 text-center text-muted">{t('view.opening')}</p>
  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <p className="text-lg font-semibold">{errorMessage(t, state.error)}</p>
        <a href="#/" className="text-lb-blue hover:underline">
          {t('view.makeYourOwnLink')}
        </a>
      </div>
    )
  }
  const { item } = state
  if (item.kind === 'tournament') return <SharedTournamentView tournament={item.tournament} />
  if (item.kind === 'ranking') return <SharedRankingView ranking={item.ranking} />
  return <SharedListView list={item.list} code={code} />
}

function MakeYourOwn() {
  const t = useT()
  return (
    <a href="#/" className="inline-flex items-center rounded-md bg-lb-green px-3 py-1.5 text-sm font-semibold text-ink hover:brightness-110">
      {t('view.makeYourOwn')}
    </a>
  )
}

function SharedListView({ list, code }: { list: SharedList; code: string }) {
  const t = useT()
  const notify = useStore((s) => s.notify)
  const hasOwnBoard = useStore((s) => s.tiers.some((tier) => tier.filmIds.length > 0))
  const [exporting, setExporting] = useState(false)
  const [other, setOther] = useState('')
  const board = useMemo(() => boardFromSharedList(list), [list])
  const filmById = useMemo(() => new Map(board.films.map((f) => [f.id, f])), [board])
  const otherCode = shareCodeFrom(other)

  const exportPng = async () => {
    setExporting(true)
    try {
      const rows = board.tiers.map((tier) => ({ tier, films: tier.filmIds.map((id) => filmById.get(id)!) }))
      const options = { columns: 10, title: list.title, footer: t('common.pngFooter') }
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
          <h1 className="text-2xl font-bold">{list.title || t('view.untitled')}</h1>
          <p className="text-sm text-muted">{t('view.subtitle', { films: t('common.films', { count: board.films.length }) })}</p>
        </div>
        <div className="flex gap-2">
          <Button disabled={exporting} onClick={() => void exportPng()}>
            {exporting ? t('common.rendering') : t('common.downloadPng')}
          </Button>
          <MakeYourOwn />
        </div>
      </div>
      <StaticTierList tiers={board.tiers} filmById={filmById} matches={board.matches} cardWidth={72} large />

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-panel p-4 text-sm">
        <span className="font-semibold">{t('compare.title')}</span>
        {hasOwnBoard && <Button onClick={() => navigate({ page: 'compare', a: code, b: 'mine' })}>{t('compare.withMine')}</Button>}
        <form
          className="flex min-w-0 flex-1 flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (otherCode) navigate({ page: 'compare', a: code, b: otherCode })
          }}
        >
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder={t('compare.pastePlaceholder')} className={`${inputClass} min-w-0 flex-1`} />
          <Button type="submit" disabled={!otherCode}>
            {t('compare.go')}
          </Button>
        </form>
      </div>
    </div>
  )
}

function SharedTournamentView({ tournament }: { tournament: SharedTournament }) {
  const t = useT()
  const notify = useStore((s) => s.notify)
  const { imageTexts } = useTournamentText()
  const { bracket, matches } = useMemo(() => tournamentFromShared(tournament), [tournament])
  const [exporting, setExporting] = useState(false)

  const exportPng = async () => {
    setExporting(true)
    try {
      downloadBlob(await renderTournamentPng(bracket, matches, imageTexts(tournament.title, bracket)), `tournament-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: t('common.imageFailed', { message: errorMessage(t, error) }) })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-2">
      <h1 className="text-center text-2xl font-bold">{tournament.title}</h1>
      <TournamentResults
        tournament={bracket}
        matches={matches}
        readOnly
        actions={
          <>
            <Button disabled={exporting} onClick={() => void exportPng()}>
              {exporting ? t('common.rendering') : t('common.downloadImage')}
            </Button>
            <MakeYourOwn />
          </>
        }
      />
    </div>
  )
}

function SharedRankingView({ ranking }: { ranking: SharedRanking }) {
  const t = useT()
  const { films, matches } = useMemo(() => rankingFromShared(ranking), [ranking])
  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ranking.title}</h1>
          <p className="text-sm text-muted">{t('view.subtitle', { films: t('common.films', { count: films.length }) })}</p>
        </div>
        <MakeYourOwn />
      </div>
      <RankingList films={films} matches={matches} />
    </div>
  )
}
