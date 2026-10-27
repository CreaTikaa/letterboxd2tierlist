import { useEffect, useMemo, useState } from 'react'
import { RankingList } from '../components/RankingList'
import { StaticTierList } from '../components/StaticTierList'
import { textColorFor } from '../lib/export/canvas'
import { errorMessage, useT } from '../i18n'
import { useTournamentText } from '../i18n/tournamentText'
import { compareLists, rankingAsList, tournamentAsList } from '../lib/compare'
import { titleKey } from '../lib/letterboxd/parse'
import { posterUrl } from '../lib/tmdb/client'
import { boardFromSharedList, decodeShared, rankingFromShared, sharedListFromBoard, type SharedItem, type SharedList, type SharedRanking } from '../lib/share'
import { useStore } from '../store/useStore'

/** One side of the comparison: tiers to compare (a ranking has one film per tier), and the ranking itself to show it as one. */
interface Side {
  list: SharedList
  ranking?: SharedRanking
}

type State = { status: 'loading' } | { status: 'ready'; a: Side; b: Side } | { status: 'error'; error: unknown }

function ListColumn({ side, common, title }: { side: Side; common: Set<string>; title: string }) {
  const board = useMemo(() => (side.ranking ? { ...rankingFromShared(side.ranking), tiers: null } : boardFromSharedList(side.list)), [side])
  const filmById = useMemo(() => new Map(board.films.map((f) => [f.id, f])), [board])
  // Films only this list has are faded, so shared ones stand out.
  const dimmed = useMemo(() => new Set(board.films.filter((f) => !common.has(titleKey(f))).map((f) => f.id)), [board, common])
  return (
    <div className="min-w-0 space-y-2">
      <h2 className="truncate font-semibold">{title}</h2>
      {board.tiers ? (
        <StaticTierList tiers={board.tiers} filmById={filmById} matches={board.matches} cardWidth={48} dimmed={dimmed} />
      ) : (
        <RankingList films={board.films} matches={board.matches} small dimmed={dimmed} />
      )}
    </div>
  )
}

/** Two tier lists, tournaments or rankings side by side, with how much they agree and where they differ most. */
export function ComparePage({ a, b }: { a: string; b: string }) {
  const t = useT()
  const { placeLabel } = useTournamentText()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const mine = (): Side => {
      const { tiers, films, lists, matches } = useStore.getState()
      return { list: sharedListFromBoard(t('compare.mine'), tiers, [...films, ...lists.flatMap((l) => l.films)], matches) }
    }
    const side = (item: SharedItem): Side => {
      if (item.kind === 'tierlist') return { list: item.list }
      if (item.kind === 'ranking') return { list: rankingAsList(item.ranking), ranking: item.ranking }
      return { list: tournamentAsList(item.tournament, placeLabel) }
    }
    Promise.all([decodeShared(a).then(side), b === 'mine' ? mine() : decodeShared(b).then(side)]).then(
      ([sideA, sideB]) => !cancelled && setState({ status: 'ready', a: sideA, b: sideB }),
      (error: unknown) => !cancelled && setState({ status: 'error', error }),
    )
    return () => {
      cancelled = true
    }
    // Your own board is read once, when the page opens.
  }, [a, b, t, placeLabel])

  const comparison = useMemo(() => (state.status === 'ready' ? compareLists(state.a.list, state.b.list) : null), [state])
  const common = useMemo(() => new Set(comparison?.common.map((c) => titleKey(c)) ?? []), [comparison])

  if (state.status === 'loading') return <p className="py-10 text-center text-muted">{t('view.opening')}</p>
  if (state.status === 'error' || !comparison) {
    return <p className="py-10 text-center text-lg font-semibold">{errorMessage(t, state.status === 'error' ? state.error : null)}</p>
  }

  const titleA = state.a.list.title || t('view.untitled')
  const titleB = state.b.list.title || t('view.untitled')
  const label = (list: SharedList, index: number) => {
    const tier = list.tiers[index]
    return (
      <span className="inline-block min-w-7 rounded px-1.5 text-center text-xs font-bold" style={{ background: tier.color, color: textColorFor(tier.color) }}>
        {tier.label}
      </span>
    )
  }
  const disagreements = comparison.common.filter((c) => c.gap > 0).slice(0, 12)

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">
          {titleA} <span className="text-muted">vs</span> {titleB}
        </h1>
        {comparison.common.length > 0 ? (
          <>
            <p className="text-5xl font-black text-lb-green">{comparison.agreement}%</p>
            <p className="text-sm text-muted">
              {t('compare.summary', { common: comparison.common.length, onlyA: comparison.onlyA, onlyB: comparison.onlyB, a: titleA, b: titleB })}
            </p>
          </>
        ) : (
          <p className="text-muted">{t('compare.nothingInCommon')}</p>
        )}
      </div>

      {disagreements.length > 0 && (
        <div className="space-y-2 rounded-xl bg-panel p-4">
          <h2 className="font-semibold">{t('compare.disagreements')}</h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {disagreements.map((c) => (
              <li key={titleKey(c)} className="flex items-center gap-2 text-sm">
                <span className="h-9 w-6 shrink-0 overflow-hidden rounded-sm bg-raised">
                  {c.poster && <img src={posterUrl(c.poster, 'w92')} alt="" loading="lazy" className="size-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {c.name} <span className="text-muted">{c.year ?? ''}</span>
                </span>
                {label(state.a.list, c.tierA)}
                <span className="text-muted">→</span>
                {label(state.b.list, c.tierB)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ListColumn side={state.a} common={common} title={titleA} />
        <ListColumn side={state.b} common={common} title={titleB} />
      </div>
    </div>
  )
}
