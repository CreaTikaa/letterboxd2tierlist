import { useEffect, useMemo, useState } from 'react'
import { ImportPanel } from '../components/ImportPanel'
import { ShareLinkButton } from '../components/ShareLinkButton'
import { SourceSelect } from '../components/SourceSelect'
import {
  BracketSizeSelect,
  GenreSelect,
  MatchHeader,
  MatchupCard,
  SeedPreview,
  SelectionModeSelect,
  TournamentResults,
} from '../components/tournament/shared'
import { useSeedLookup } from '../components/tournament/useSeedLookup'
import { Button, inputClass } from '../components/ui'
import { useVisibleFilms } from '../hooks'
import { useUndoKey } from '../hooks/useHistory'
import { errorMessage, useT } from '../i18n'
import { Trans } from '../i18n/Trans'
import { useTournamentText } from '../i18n/tournamentText'
import { dateStamp, downloadBlob } from '../lib/download'
import { renderTournamentPng } from '../lib/export/tournamentPng'
import { genresOf, sourceFilms } from '../lib/filter'
import { RATING_VALUES, stars } from '../lib/ratings'
import { sharedTournamentFrom } from '../lib/share'
import {
  MIN_ENTRANTS,
  bracketSizeOptions,
  createTournament,
  currentMatch,
  entrants,
  pick,
  pickBracketSize,
  seedFilms,
  standingsToTiers,
  undo,
  type SelectionMode,
  type Tournament,
} from '../lib/tournament'
import type { Film } from '../lib/types'
import { navigate } from '../router'
import { useStore } from '../store/useStore'

export function TournamentPage() {
  const films = useStore((s) => s.films)
  const tournament = useStore((s) => s.tournament)

  if (!tournament && films.length === 0) return <ImportPanel />
  if (!tournament) return <Setup films={films} />
  if (currentMatch(tournament)) return <MatchView tournament={tournament} />
  return <Results tournament={tournament} />
}

function Setup({ films }: { films: Film[] }) {
  const setTournament = useStore((s) => s.setTournament)
  const matches = useStore((s) => s.matches)
  const lists = useStore((s) => s.lists)
  const [source, setSource] = useState('all')
  const [genre, setGenre] = useState(0)
  const visible = useVisibleFilms()
  const base = useMemo(() => (source === 'visible' ? visible : sourceFilms(films, lists, source)), [films, lists, source, visible])
  const [minRating, setMinRating] = useState(0)
  const [includeUnrated, setIncludeUnrated] = useState(false)
  const [mode, setMode] = useState<SelectionMode>('top')
  const [requested, setRequested] = useState(16)
  const [shuffleKey, setShuffleKey] = useState(0)
  const t = useT()

  const rated = useMemo(() => base.filter((f) => (f.rating == null ? includeUnrated : f.rating >= minRating)), [base, minRating, includeUnrated])
  const eligible = useMemo(() => (genre ? rated.filter((f) => genresOf(matches[f.id])?.includes(genre)) : rated), [rated, genre, matches])
  const options = useMemo(() => bracketSizeOptions(eligible.length), [eligible.length])
  const count = pickBracketSize(options, requested)

  // shuffleKey forces a new random draw / tie-break order.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seeds = useMemo(() => (count >= MIN_ENTRANTS ? seedFilms(eligible, count, mode) : []), [eligible, count, mode, shuffleKey])

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('tournament.title')}</h1>
        <p className="text-muted">{t('tournament.intro')}</p>
        <p className="text-sm text-muted">
          <Trans
            k="tournament.withFriends"
            tags={{
              link: (text) => (
                <a href="#/rooms" className="text-lb-blue hover:underline">
                  {text}
                </a>
              ),
            }}
          />
        </p>
      </div>

      <div className="grid gap-4 rounded-xl bg-panel p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <SourceSelect value={source} onChange={setSource} visibleCount={visible.length} className="flex-col !items-stretch" />
        <label className="flex flex-col gap-1 text-muted">
          {t('tournament.minRating')}
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className={inputClass}>
            <option value={0}>{t('tournament.any')}</option>
            {[...RATING_VALUES].reverse().map((r) => (
              <option key={r} value={r}>
                {t('tournament.andUp', { stars: stars(r) })}
              </option>
            ))}
          </select>
        </label>
        <SelectionModeSelect value={mode} onChange={setMode} topLabel={t('tournament.topRated')} />
        <GenreSelect films={rated} value={genre} onChange={setGenre} />
        <BracketSizeSelect value={count} options={options} onChange={setRequested} />
        <label className="flex items-center gap-2 self-end pb-2 text-muted">
          <input type="checkbox" checked={includeUnrated} onChange={(e) => setIncludeUnrated(e.target.checked)} className="accent-lb-green" />
          {t('tournament.includeUnrated')}
        </label>
      </div>

      <SeedPreview
        seeds={seeds}
        eligibleCount={eligible.length}
        mode={mode}
        onReshuffle={() => setShuffleKey((k) => k + 1)}
        onStart={() => setTournament(createTournament(seeds))}
        emptyMessage={t('tournament.notEnough')}
      />
    </div>
  )
}

function MatchView({ tournament: bracket }: { tournament: Tournament }) {
  const setTournament = useStore((s) => s.setTournament)
  const [chosen, setChosen] = useState<string | null>(null)
  const t = useT()
  const current = currentMatch(bracket)!
  const [aId, bId] = entrants(bracket, current.round, current.match)
  const seedOf = useSeedLookup(bracket)
  const a = seedOf.get(aId!)!
  const b = seedOf.get(bId!)!

  const choose = (id: string) => {
    if (chosen) return
    setChosen(id)
    setTimeout(() => {
      setTournament(pick(bracket, id))
      setChosen(null)
    }, 250)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' || e.key === '1') choose(a.film.id)
      if (e.key === 'ArrowRight' || e.key === '2') choose(b.film.id)
      if ((e.key === 'Backspace' || e.key.toLowerCase() === 'z') && bracket.history.length) setTournament(undo(bracket))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const state = (id: string) => (!chosen ? 'idle' : chosen === id ? 'won' : 'lost')

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <MatchHeader tournament={bracket} round={current.round} match={current.match} />
      <div className="flex items-start justify-center gap-3 sm:gap-6">
        <MatchupCard film={a.film} seed={a.seed} hint={t('tournament.keyLeft')} state={state(a.film.id)} onPick={() => choose(a.film.id)} />
        <span className="mt-[30%] shrink-0 text-xl font-black text-muted sm:text-3xl">{t('tournament.vs')}</span>
        <MatchupCard film={b.film} seed={b.seed} hint={t('tournament.keyRight')} state={state(b.film.id)} onPick={() => choose(b.film.id)} />
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="ghost" disabled={!bracket.history.length || Boolean(chosen)} onClick={() => setTournament(undo(bracket))}>
          {t('tournament.undo')}
        </Button>
        <Button variant="ghost" onClick={() => confirm(t('tournament.quitConfirm')) && setTournament(null)}>
          {t('tournament.quit')}
        </Button>
      </div>
    </div>
  )
}

function Results({ tournament: bracket }: { tournament: Tournament }) {
  const matches = useStore((s) => s.matches)
  const setTournament = useStore((s) => s.setTournament)
  const setTiers = useStore((s) => s.setTiers)
  const notify = useStore((s) => s.notify)
  const [exporting, setExporting] = useState(false)
  const t = useT()
  const { imageTexts } = useTournamentText()
  useUndoKey(() => setTournament(undo(bracket)))

  const exportPng = async () => {
    setExporting(true)
    try {
      downloadBlob(await renderTournamentPng(bracket, matches, imageTexts(t('tournament.imageTitle'), bracket)), `tournament-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: t('common.imageFailed', { message: errorMessage(t, error) }) })
    } finally {
      setExporting(false)
    }
  }

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
              if (!confirm(t('tournament.sendConfirm'))) return
              setTiers(standingsToTiers(bracket, useStore.getState().tiers))
              notify({ kind: 'success', text: t('tournament.sent', { count: bracket.seeds.length }) })
              navigate({ page: 'tierlist' })
            }}
          >
            {t('tournament.sendToTierList')}
          </Button>
          <ShareLinkButton
            variant="secondary"
            label={t('share.short')}
            build={() => ({ kind: 'tournament', tournament: sharedTournamentFrom(t('tournament.shareTitle'), bracket, matches) })}
          />
          <Button onClick={() => setTournament(createTournament(bracket.seeds))}>{t('tournament.replay')}</Button>
          <Button variant="ghost" onClick={() => setTournament(undo(bracket))}>
            {t('tournament.undoFinal')}
          </Button>
          <Button variant="ghost" onClick={() => setTournament(null)}>
            {t('tournament.new')}
          </Button>
        </>
      }
    />
  )
}
