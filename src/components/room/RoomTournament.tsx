import { useEffect, useMemo, useState } from 'react'
import { errorMessage, useLocale, useT } from '../../i18n'
import { Trans } from '../../i18n/Trans'
import { useTournamentText } from '../../i18n/tournamentText'
import { dateStamp, downloadBlob } from '../../lib/download'
import { renderTournamentPng } from '../../lib/export/tournamentPng'
import { genresOf } from '../../lib/filter'
import { RATING_VALUES, ratingText, stars } from '../../lib/ratings'
import { groupFilms, memberColor, type GroupFilm } from '../../lib/room/group'
import { decideWinner, eligibleGroupFilms, matchKey, voteCounts } from '../../lib/room/groupTournament'
import type { MatchRecord, RoomTournament as RoomTournamentState } from '../../lib/room/types'
import {
  MIN_ENTRANTS,
  bracketSizeOptions,
  createTournament,
  currentMatch,
  entrants,
  pickBracketSize,
  seedFilms,
  standingsToTiers,
  type SelectionMode,
  type Tournament,
} from '../../lib/tournament'
import { onlineMemberIds, useRoom } from '../../store/useRoom'
import { useStore } from '../../store/useStore'
import {
  BracketSizeSelect,
  GenreSelect,
  MatchHeader,
  MatchupCard,
  SeedPreview,
  SelectionModeSelect,
  TournamentResults,
  type CardState,
} from '../tournament/shared'
import { useSeedLookup } from '../tournament/useSeedLookup'
import { Button, inputClass } from '../ui'
import { MemberTag } from './names'
import { useNameOf } from './useNameOf'

export function RoomTournament() {
  const view = useRoom((s) => s.view)!
  const films = useMemo(() => groupFilms(Object.values(view.state.members)), [view.state.members])
  const groupById = useMemo(() => new Map(films.map((f) => [f.id, f])), [films])
  const { tournament } = view.state

  if (!tournament.bracket) return <Setup films={films} />
  if (currentMatch(tournament.bracket)) return <Voting tournament={tournament} bracket={tournament.bracket} groupById={groupById} />
  return <Results tournament={tournament} bracket={tournament.bracket} />
}

function Setup({ films }: { films: GroupFilm[] }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const nameOf = useNameOf()
  const sharing = Object.keys(view.state.members).length
  const [minWatchers, setMinWatchers] = useState(Math.max(1, sharing))
  const [minMedian, setMinMedian] = useState(0)
  const [mode, setMode] = useState<SelectionMode>('top')
  const [requested, setRequested] = useState(16)
  const [shuffleKey, setShuffleKey] = useState(0)
  const [genre, setGenre] = useState(0)
  const matches = useStore((s) => s.matches)
  const t = useT()

  // "Everyone" follows the member count as people join.
  const [lastSharing, setLastSharing] = useState(sharing)
  if (sharing !== lastSharing) {
    setLastSharing(sharing)
    if (minWatchers === lastSharing || minWatchers > sharing) setMinWatchers(Math.max(1, sharing))
  }

  const qualifying = useMemo(() => eligibleGroupFilms(films, { minWatchers, minMedian }), [films, minWatchers, minMedian])
  const eligible = useMemo(() => (genre ? qualifying.filter((f) => genresOf(matches[f.id])?.includes(genre)) : qualifying), [qualifying, genre, matches])
  const options = useMemo(() => bracketSizeOptions(eligible.length), [eligible.length])
  const count = pickBracketSize(options, requested)
  // shuffleKey forces a new random draw / tie-break order.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seeds = useMemo(() => (count >= MIN_ENTRANTS ? seedFilms(eligible, count, mode) : []), [eligible, count, mode, shuffleKey])

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl bg-panel p-5 text-sm">
        <h2 className="text-lg font-semibold">{t('groupTournament.title')}</h2>
        <p className="text-muted">
          <Trans k="groupTournament.intro" tags={{ b: (text) => <span className="text-text">{text}</span> }} />
        </p>
      </div>

      {!view.isHost ? (
        <p className="rounded-xl bg-panel p-5 text-sm text-muted">
          {t('groupTournament.waitingHost', { host: view.hostMemberId ? nameOf(view.hostMemberId) : t('showdown.connecting') })}
        </p>
      ) : sharing === 0 ? (
        <p className="rounded-xl bg-panel p-5 text-sm text-muted">{t('groupTournament.needFilms')}</p>
      ) : (
        <>
          <div className="grid gap-4 rounded-xl bg-panel p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-muted">
              {t('groupTournament.seenBy')}
              <select value={minWatchers} onChange={(e) => setMinWatchers(Number(e.target.value))} className={inputClass}>
                {Array.from({ length: sharing }, (_, i) => sharing - i).map((n) => (
                  <option key={n} value={n}>
                    {n === sharing
                      ? sharing > 1
                        ? t('groupTournament.everyoneCount', { count: n })
                        : t('groupTournament.everyone')
                      : t('groupTournament.atLeast', { count: n })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted">
              {t('groupTournament.minMedian')}
              <select value={minMedian} onChange={(e) => setMinMedian(Number(e.target.value))} className={inputClass}>
                <option value={0}>{t('groupTournament.anyInclUnrated')}</option>
                {[...RATING_VALUES].reverse().map((r) => (
                  <option key={r} value={r}>
                    {t('tournament.andUp', { stars: stars(r) })}
                  </option>
                ))}
              </select>
            </label>
            <SelectionModeSelect value={mode} onChange={setMode} topLabel={t('groupTournament.highestMedian')} />
            <GenreSelect films={qualifying} value={genre} onChange={setGenre} />
            <BracketSizeSelect value={count} options={options} onChange={setRequested} />
          </div>
          <SeedPreview
            seeds={seeds}
            eligibleCount={eligible.length}
            mode={mode}
            onReshuffle={() => setShuffleKey((k) => k + 1)}
            onStart={() => dispatch({ t: 'tn-start', bracket: createTournament(seeds) })}
            startLabel={t('groupTournament.start')}
            emptyMessage={minWatchers > 1 ? t('groupTournament.notEnoughSeen') : t('groupTournament.notEnough')}
          />
        </>
      )}
    </div>
  )
}

/** Each member's rating for a film, as small coloured chips. */
function RatingChips({ film }: { film: GroupFilm | undefined }) {
  const nameOf = useNameOf()
  if (!film) return null
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-1 text-xs">
      {Object.entries(film.ratings).map(([memberId, rating]) => (
        <span key={memberId} className="inline-flex items-center gap-1 text-muted" title={nameOf(memberId)}>
          <span className="size-1.5 rounded-full" style={{ background: memberColor(memberId) }} />
          {nameOf(memberId).slice(0, 10)} <span className="text-lb-green">{rating == null ? '–' : stars(rating)}</span>
        </span>
      ))}
    </div>
  )
}

function LastResult({ record, bracket }: { record: MatchRecord; bracket: Tournament }) {
  const seedOf = useSeedLookup(bracket)
  const t = useT()
  const nameOf = useNameOf()
  const [a, b] = entrants(bracket, record.round, record.match)
  const loserId = a === record.winnerId ? b : a
  const counts = voteCounts(record.votes, [a, b])
  const winner = seedOf.get(record.winnerId)!.film
  const loser = loserId ? seedOf.get(loserId)!.film : null
  const tie = loserId != null && counts.get(record.winnerId) === counts.get(loserId)
  return (
    <div className="rounded-lg bg-panel px-4 py-2 text-center text-sm">
      <span className="text-muted">{t('groupTournament.lastMatch')} </span>
      <span className="font-semibold text-lb-green">{winner.name}</span>
      {loser && (
        <>
          {' '}
          {t('groupTournament.beat', { loser: loser.name })}{' '}
          <span className="font-semibold">
            {counts.get(record.winnerId)}–{counts.get(loserId!)}
          </span>
          {tie && <span className="text-muted"> {t('groupTournament.tie')}</span>}
        </>
      )}
      {Object.keys(record.votes).length > 0 && (
        <span className="block text-xs text-muted">
          {Object.entries(record.votes)
            .map(([memberId, filmId]) => `${nameOf(memberId)} → ${seedOf.get(filmId)?.film.name ?? '?'}`)
            .join(' · ')}
        </span>
      )}
    </div>
  )
}

function Voting({ tournament, bracket, groupById }: { tournament: RoomTournamentState; bracket: Tournament; groupById: Map<string, GroupFilm> }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const me = useStore((s) => s.profile.memberId)
  const seedOf = useSeedLookup(bracket)
  const current = currentMatch(bracket)!
  const key = matchKey(current.round, current.match)
  const [aId, bId] = entrants(bracket, current.round, current.match)
  const a = seedOf.get(aId!)!
  const b = seedOf.get(bId!)!
  const myVote = tournament.votes[me]
  const online = onlineMemberIds(view, me)
  const voted = Object.keys(tournament.votes)
  const lastRecord = tournament.log.at(-1)
  const t = useT()
  const locale = useLocale()

  const vote = (filmId: string) => dispatch({ t: 'tn-vote', memberId: me, matchKey: key, filmId })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft' || e.key === '1') vote(a.film.id)
      if (e.key === 'ArrowRight' || e.key === '2') vote(b.film.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const state = (id: string): CardState => (myVote === id ? 'selected' : 'idle')
  const subtitle = (film: { rating: number | null }) => (
    <span className="text-lb-green">{t('groupTournament.median', { rating: ratingText(film.rating, locale) || t('common.unrated') })}</span>
  )

  const closeVote = () => {
    const winnerId = decideWinner(bracket, tournament.votes)
    if (winnerId) dispatch({ t: 'tn-resolve', matchKey: key, winnerId })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <MatchHeader tournament={bracket} round={current.round} match={current.match} />
      {lastRecord && <LastResult record={lastRecord} bracket={bracket} />}

      <div className="flex items-start justify-center gap-3 sm:gap-6">
        <MatchupCard
          film={a.film}
          seed={a.seed}
          hint={t('tournament.keyLeft')}
          state={state(a.film.id)}
          onPick={() => vote(a.film.id)}
          subtitle={subtitle(a.film)}
          footer={<RatingChips film={groupById.get(a.film.id)} />}
        />
        <span className="mt-[30%] shrink-0 text-xl font-black text-muted sm:text-3xl">{t('tournament.vs')}</span>
        <MatchupCard
          film={b.film}
          seed={b.seed}
          hint={t('tournament.keyRight')}
          state={state(b.film.id)}
          onPick={() => vote(b.film.id)}
          subtitle={subtitle(b.film)}
          footer={<RatingChips film={groupById.get(b.film.id)} />}
        />
      </div>

      <div className="space-y-2 rounded-xl bg-panel p-4 text-sm">
        <p className="text-center">
          {myVote ? t('groupTournament.voteCast') : t('groupTournament.howToVote')}{' '}
          <span className="text-muted">{t('groupTournament.votesHidden')}</span>
        </p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {online.map((id) => (
            <MemberTag key={id} memberId={id} suffix={tournament.votes[id] ? t('groupTournament.voted') : t('groupTournament.thinking')} />
          ))}
        </div>
        {view.isHost && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button
              onClick={closeVote}
              disabled={voted.length === 0}
              title={t('groupTournament.closeVoteTitle')}
            >
              {t('groupTournament.closeVote', { voted: voted.length, online: online.length })}
            </Button>
            <Button variant="ghost" disabled={!lastRecord} onClick={() => lastRecord && dispatch({ t: 'tn-undo', matchKey: matchKey(lastRecord.round, lastRecord.match) })}>
              {t('groupTournament.undoLast')}
            </Button>
            <Button variant="ghost" onClick={() => confirm(t('groupTournament.stopConfirm')) && dispatch({ t: 'tn-reset' })}>
              {t('groupTournament.stop')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Results({ tournament, bracket }: { tournament: RoomTournamentState; bracket: Tournament }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const matches = useStore((s) => s.matches)
  const notify = useStore((s) => s.notify)
  const seedOf = useSeedLookup(bracket)
  const [exporting, setExporting] = useState(false)
  const lastRecord = tournament.log.at(-1)
  const t = useT()
  const { roundLabel, imageTexts } = useTournamentText()

  const exportPng = async () => {
    setExporting(true)
    try {
      const texts = imageTexts(t('groupTournament.imageTitle', { room: view.state.id }), bracket)
      downloadBlob(await renderTournamentPng(bracket, matches, texts), `room-${view.state.id}-tournament-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: t('common.imageFailed', { message: errorMessage(t, error) }) })
    } finally {
      setExporting(false)
    }
  }

  const records = tournament.log.map((record) => {
    const [a, b] = entrants(bracket, record.round, record.match)
    const counts = voteCounts(record.votes, [a, b])
    const loserId = a === record.winnerId ? b : a
    return { record, loserId, won: counts.get(record.winnerId) ?? 0, lost: loserId ? (counts.get(loserId) ?? 0) : 0 }
  })

  return (
    <TournamentResults
      tournament={bracket}
      actions={
        <>
          <Button variant="primary" disabled={exporting} onClick={() => void exportPng()}>
            {exporting ? t('common.rendering') : t('common.downloadImage')}
          </Button>
          <Button
            onClick={() => {
              if (!confirm(t('groupTournament.sendConfirm'))) return
              dispatch({ t: 'board', tiers: standingsToTiers(bracket, view.state.board) })
              notify({ kind: 'success', text: t('groupTournament.sent') })
            }}
          >
            {t('groupTournament.sendToBoard')}
          </Button>
          {view.isHost && (
            <>
              <Button onClick={() => dispatch({ t: 'tn-start', bracket: createTournament(bracket.seeds) })}>{t('tournament.replay')}</Button>
              <Button variant="ghost" disabled={!lastRecord} onClick={() => lastRecord && dispatch({ t: 'tn-undo', matchKey: matchKey(lastRecord.round, lastRecord.match) })}>
                {t('groupTournament.undoFinal')}
              </Button>
              <Button variant="ghost" onClick={() => dispatch({ t: 'tn-reset' })}>
                {t('tournament.new')}
              </Button>
            </>
          )}
        </>
      }
    >
      {records.length > 0 && (
        <details className="rounded-xl bg-panel p-4 text-sm" open>
          <summary className="cursor-pointer font-semibold">{t('groupTournament.everyVote')}</summary>
          <div className="mt-3 space-y-1">
            {[...records].reverse().map(({ record, loserId, won, lost }) => (
              <p key={matchKey(record.round, record.match)} className="flex flex-wrap gap-x-2 text-muted">
                <span className="w-28 shrink-0">{roundLabel(bracket.size, record.round)}</span>
                <span className="text-text">{seedOf.get(record.winnerId)!.film.name}</span>
                {loserId && (
                  <>
                    <span>
                      {won}–{lost}
                    </span>
                    <span>{seedOf.get(loserId)!.film.name}</span>
                  </>
                )}
                {loserId && won === lost && won > 0 && <span className="text-lb-orange">{t('groupTournament.tieShort')}</span>}
              </p>
            ))}
          </div>
        </details>
      )}
    </TournamentResults>
  )
}
