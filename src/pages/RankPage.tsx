import { useEffect, useMemo, useState } from 'react'
import { ImportPanel } from '../components/ImportPanel'
import { RankingList } from '../components/RankingList'
import { ShareLinkButton } from '../components/ShareLinkButton'
import { MatchupCard } from '../components/tournament/shared'
import { Button } from '../components/ui'
import { isTyping, useUndoKey } from '../hooks/useHistory'
import { useVisibleFilms } from '../hooks'
import { useT } from '../i18n'
import { Trans } from '../i18n/Trans'
import { stars } from '../lib/ratings'
import { answer, createRanking, estimatePicks, groupsFor, rankingOrder, rankingToTiers, replay, undoAnswer, type RankMode, type RankSession } from '../lib/rank'
import { sharedRankingFrom } from '../lib/share'
import { navigate } from '../router'
import { useStore } from '../store/useStore'

/** Beyond this many picks, suggest narrowing the films first. */
const MANY_PICKS = 600

export function RankPage() {
  const films = useStore((s) => s.films)
  const ranking = useStore((s) => s.ranking)
  const state = useMemo(() => (ranking ? replay(ranking) : null), [ranking])

  if (!ranking && films.length === 0) return <ImportPanel />
  if (!ranking || !state) return <Setup />
  if (state.next) return <Picking ranking={ranking} />
  return <Results ranking={ranking} order={rankingOrder(state)} />
}

function Setup() {
  const t = useT()
  const candidates = useVisibleFilms()
  const setRanking = useStore((s) => s.setRanking)
  const [mode, setMode] = useState<RankMode>('ties')
  const picks = useMemo(
    () => ({ ties: estimatePicks(groupsFor(candidates, 'ties')), full: estimatePicks(groupsFor(candidates, 'full')) }),
    [candidates],
  )

  const option = (value: RankMode, title: string, help: string) => (
    <label
      className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 text-sm transition ${mode === value ? 'border-lb-green bg-lb-green/10' : 'border-line bg-panel hover:border-muted'}`}
    >
      <span className="flex items-center gap-2 font-semibold">
        <input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} className="accent-lb-green" />
        {title}
      </span>
      <span className="text-muted">{help}</span>
      <span className="text-xs text-lb-green">{t('rank.picks', { count: picks[value] })}</span>
    </label>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('rank.title')}</h1>
        <p className="text-muted">{t('rank.intro')}</p>
      </div>

      <p className="rounded-xl bg-panel p-4 text-sm text-muted">
        <Trans
          k="rank.candidates"
          params={{ count: candidates.length }}
          tags={{
            b: (text) => <span className="font-semibold text-text">{text}</span>,
            link: (text) => (
              <a href="#/" className="text-lb-blue hover:underline">
                {text}
              </a>
            ),
          }}
        />
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {option('ties', t('rank.modeTies'), t('rank.modeTiesHelp'))}
        {option('full', t('rank.modeFull'), t('rank.modeFullHelp'))}
      </div>
      {picks[mode] > MANY_PICKS && <p className="text-sm text-lb-orange">{t('rank.manyPicks')}</p>}

      <Button variant="primary" className="w-full py-3 text-base" disabled={candidates.length < 2} onClick={() => setRanking(createRanking(candidates, mode))}>
        {t('rank.start')}
      </Button>
    </div>
  )
}

function Picking({ ranking }: { ranking: RankSession }) {
  const t = useT()
  const setRanking = useStore((s) => s.setRanking)
  const state = replay(ranking)
  const next = state.next!
  const byId = useMemo(() => new Map(ranking.films.map((f) => [f.id, f])), [ranking.films])
  const candidate = byId.get(next.candidate)!
  const opponent = byId.get(next.opponent)!
  const estimate = useMemo(() => estimatePicks(ranking.groups), [ranking.groups])
  const ranked = state.sorted.reduce((sum, group) => sum + group.length, 0)

  const choose = (preferCandidate: boolean) => setRanking(answer(ranking, preferCandidate))
  const back = () => ranking.answers.length && setRanking(undoAnswer(ranking))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'arrowleft' || key === '1') choose(true)
      else if (key === 'arrowright' || key === '2') choose(false)
      else if (key === 'z' || key === 'backspace') back()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <div className="space-y-2 text-center">
        {ranking.mode === 'ties' && (
          <p className="text-sm tracking-widest text-lb-orange uppercase">
            {candidate.rating == null ? t('common.unrated') : t('rank.group', { stars: stars(candidate.rating) })}
          </p>
        )}
        <h1 className="text-2xl font-bold">{t('rank.question')}</h1>
        <div className="mx-auto h-1.5 max-w-md overflow-hidden rounded-full bg-raised">
          <div className="h-full bg-lb-green transition-[width]" style={{ width: `${Math.min(100, (ranking.answers.length / Math.max(1, estimate)) * 100)}%` }} />
        </div>
        <p className="text-xs text-muted">{t('rank.progress', { picks: ranking.answers.length, estimate, ranked, total: ranking.films.length })}</p>
      </div>
      <div className="flex items-start justify-center gap-3 sm:gap-6">
        <MatchupCard film={candidate} state="idle" hint={t('tournament.keyLeft')} onPick={() => choose(true)} />
        <span className="mt-[30%] shrink-0 text-xl font-black text-muted sm:text-3xl">{t('tournament.vs')}</span>
        <MatchupCard film={opponent} state="idle" hint={t('tournament.keyRight')} onPick={() => choose(false)} />
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="ghost" disabled={!ranking.answers.length} onClick={back} title={t('board.undo')}>
          {t('tournament.undo')}
        </Button>
        <Button variant="ghost" onClick={() => confirm(t('rank.quitConfirm')) && setRanking(null)}>
          {t('tournament.quit')}
        </Button>
      </div>
    </div>
  )
}

function Results({ ranking, order }: { ranking: RankSession; order: string[] }) {
  const t = useT()
  const matches = useStore((s) => s.matches)
  const setRanking = useStore((s) => s.setRanking)
  const setTiers = useStore((s) => s.setTiers)
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const notify = useStore((s) => s.notify)
  useUndoKey(() => setRanking(undoAnswer(ranking)), ranking.answers.length > 0)
  const films = useMemo(() => {
    const byId = new Map(ranking.films.map((f) => [f.id, f]))
    return order.map((id) => byId.get(id)!).filter(Boolean)
  }, [ranking.films, order])

  const sendToTierList = () => {
    if (!confirm(ranking.mode === 'ties' ? t('rank.sendConfirmTies') : t('rank.sendConfirmFull'))) return
    const { tiers, ratingMap } = useStore.getState()
    setTiers(rankingToTiers(order, ranking.films, tiers, ranking.mode, ratingMap))
    notify({ kind: 'success', text: t('rank.sent', { count: order.length }) })
    navigate({ page: 'tierlist' })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-bold">{t('rank.resultsTitle')}</h1>
        <p className="text-muted">{t('rank.resultsHelp', { count: films.length, picks: ranking.answers.length })}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={sendToTierList}>
            {t('tournament.sendToTierList')}
          </Button>
          <ShareLinkButton variant="secondary" label={t('share.short')} build={() => ({ kind: 'ranking', ranking: sharedRankingFrom(t('rank.shareTitle'), films, matches) })} />
          <Button variant="ghost" onClick={() => setRanking(undoAnswer(ranking))} title={t('board.undo')}>
            {t('rank.undoLast')}
          </Button>
          <Button variant="ghost" onClick={() => confirm(t('rank.newConfirm')) && setRanking(null)}>
            {t('rank.new')}
          </Button>
        </div>
      </div>
      <RankingList films={films} matches={matches} onFilmClick={setEditingFilm} />
    </div>
  )
}
