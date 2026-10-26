import { useEffect, useMemo, useState } from 'react'
import { ImportPanel } from '../components/ImportPanel'
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
import { dateStamp, downloadBlob } from '../lib/download'
import { renderTournamentPng } from '../lib/export/tournamentPng'
import { genresOf } from '../lib/filter'
import { RATING_VALUES, stars } from '../lib/ratings'
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
  const [genre, setGenre] = useState(0)
  const [minRating, setMinRating] = useState(0)
  const [includeUnrated, setIncludeUnrated] = useState(false)
  const [mode, setMode] = useState<SelectionMode>('top')
  const [requested, setRequested] = useState(16)
  const [shuffleKey, setShuffleKey] = useState(0)

  const rated = useMemo(() => films.filter((f) => (f.rating == null ? includeUnrated : f.rating >= minRating)), [films, minRating, includeUnrated])
  const eligible = useMemo(() => (genre ? rated.filter((f) => genresOf(matches[f.id])?.includes(genre)) : rated), [rated, genre, matches])
  const options = useMemo(() => bracketSizeOptions(eligible.length), [eligible.length])
  const count = pickBracketSize(options, requested)

  // shuffleKey forces a new random draw / tie-break order.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seeds = useMemo(() => (count >= MIN_ENTRANTS ? seedFilms(eligible, count, mode) : []), [eligible, count, mode, shuffleKey])

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Film tournament</h1>
        <p className="text-muted">
          Two films at a time: pick the one you'd rather keep. Your best-rated films are seeded so they meet as late as possible. Last film standing wins.
        </p>
        <p className="text-sm text-muted">
          Want to play with friends?{' '}
          <a href="#/rooms" className="text-lb-blue hover:underline">
            Open a room
          </a>{' '}
          and use its Tournament tab.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl bg-panel p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-muted">
          Minimum rating
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className={inputClass}>
            <option value={0}>Any</option>
            {[...RATING_VALUES].reverse().map((r) => (
              <option key={r} value={r}>
                {stars(r)} and up
              </option>
            ))}
          </select>
        </label>
        <SelectionModeSelect value={mode} onChange={setMode} topLabel="My top-rated" />
        <GenreSelect films={rated} value={genre} onChange={setGenre} />
        <BracketSizeSelect value={count} options={options} onChange={setRequested} />
        <label className="flex items-center gap-2 self-end pb-2 text-muted">
          <input type="checkbox" checked={includeUnrated} onChange={(e) => setIncludeUnrated(e.target.checked)} className="accent-lb-green" />
          Include unrated films
        </label>
      </div>

      <SeedPreview
        seeds={seeds}
        eligibleCount={eligible.length}
        mode={mode}
        onReshuffle={() => setShuffleKey((k) => k + 1)}
        onStart={() => setTournament(createTournament(seeds))}
        emptyMessage="Not enough films match. Lower the minimum rating or include unrated films."
      />
    </div>
  )
}

function MatchView({ tournament: t }: { tournament: Tournament }) {
  const setTournament = useStore((s) => s.setTournament)
  const [chosen, setChosen] = useState<string | null>(null)
  const current = currentMatch(t)!
  const [aId, bId] = entrants(t, current.round, current.match)
  const seedOf = useSeedLookup(t)
  const a = seedOf.get(aId!)!
  const b = seedOf.get(bId!)!

  const choose = (id: string) => {
    if (chosen) return
    setChosen(id)
    setTimeout(() => {
      setTournament(pick(t, id))
      setChosen(null)
    }, 250)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' || e.key === '1') choose(a.film.id)
      if (e.key === 'ArrowRight' || e.key === '2') choose(b.film.id)
      if ((e.key === 'Backspace' || e.key.toLowerCase() === 'z') && t.history.length) setTournament(undo(t))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const state = (id: string) => (!chosen ? 'idle' : chosen === id ? 'won' : 'lost')

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <MatchHeader tournament={t} round={current.round} match={current.match} />
      <div className="flex items-start justify-center gap-3 sm:gap-6">
        <MatchupCard film={a.film} seed={a.seed} hint="← or 1" state={state(a.film.id)} onPick={() => choose(a.film.id)} />
        <span className="mt-[30%] shrink-0 text-xl font-black text-muted sm:text-3xl">VS</span>
        <MatchupCard film={b.film} seed={b.seed} hint="→ or 2" state={state(b.film.id)} onPick={() => choose(b.film.id)} />
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="ghost" disabled={!t.history.length || Boolean(chosen)} onClick={() => setTournament(undo(t))}>
          ↶ Undo
        </Button>
        <Button variant="ghost" onClick={() => confirm('Quit this tournament? Progress will be lost.') && setTournament(null)}>
          Quit
        </Button>
      </div>
    </div>
  )
}

function Results({ tournament: t }: { tournament: Tournament }) {
  const matches = useStore((s) => s.matches)
  const setTournament = useStore((s) => s.setTournament)
  const setTiers = useStore((s) => s.setTiers)
  const notify = useStore((s) => s.notify)
  const [exporting, setExporting] = useState(false)

  const exportPng = async () => {
    setExporting(true)
    try {
      downloadBlob(await renderTournamentPng(t, matches, 'My Letterboxd tournament'), `tournament-${dateStamp()}.png`)
    } catch (error) {
      notify({ kind: 'error', text: `Image export failed: ${error instanceof Error ? error.message : error}` })
    } finally {
      setExporting(false)
    }
  }

  return (
    <TournamentResults
      tournament={t}
      actions={
        <>
          <Button variant="primary" disabled={exporting} onClick={() => void exportPng()}>
            {exporting ? 'Rendering…' : 'Download image'}
          </Button>
          <Button
            onClick={() => {
              if (!confirm("Place these films on your tier board by how far they got? Films already on the board move to their new tier.")) return
              setTiers(standingsToTiers(t, useStore.getState().tiers))
              notify({ kind: 'success', text: `Placed ${t.seeds.length} films on your tier list: champion in the top tier.` })
              navigate({ page: 'tierlist' })
            }}
          >
            → Send to my tier list
          </Button>
          <Button onClick={() => setTournament(createTournament(t.seeds))}>Replay same films</Button>
          <Button variant="ghost" onClick={() => setTournament(undo(t))}>
            ↶ Undo final pick
          </Button>
          <Button variant="ghost" onClick={() => setTournament(null)}>
            New tournament
          </Button>
        </>
      }
    />
  )
}
