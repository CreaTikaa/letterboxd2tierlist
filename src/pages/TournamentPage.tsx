import { useEffect, useMemo, useState } from 'react'
import { PosterCard } from '../components/board/PosterCard'
import { ImportPanel } from '../components/ImportPanel'
import { Button, inputClass } from '../components/ui'
import { dateStamp, downloadBlob } from '../lib/download'
import { renderTournamentPng } from '../lib/export/tournamentPng'
import { RATING_VALUES, stars } from '../lib/ratings'
import { posterUrl } from '../lib/tmdb/client'
import {
  MAX_ENTRANTS,
  MIN_ENTRANTS,
  champion,
  createTournament,
  currentMatch,
  entrants,
  pick,
  placeLabel,
  playableMatchCount,
  roundName,
  seedFilms,
  standings,
  undo,
  upsets,
  type SelectionMode,
  type Tournament,
} from '../lib/tournament'
import type { Film } from '../lib/types'
import { useStore } from '../store/useStore'

export function TournamentPage() {
  const films = useStore((s) => s.films)
  const tournament = useStore((s) => s.tournament)

  if (!tournament && films.length === 0) return <ImportPanel />
  if (!tournament) return <Setup films={films} />
  if (currentMatch(tournament)) return <MatchView tournament={tournament} />
  return <Results tournament={tournament} />
}

const SIZES = [8, 16, 32, 64, 128, 256]

function Setup({ films }: { films: Film[] }) {
  const matches = useStore((s) => s.matches)
  const setTournament = useStore((s) => s.setTournament)
  const [minRating, setMinRating] = useState(0)
  const [includeUnrated, setIncludeUnrated] = useState(false)
  const [mode, setMode] = useState<SelectionMode>('top')
  const [requested, setRequested] = useState(16)
  const [shuffleKey, setShuffleKey] = useState(0)

  const eligible = useMemo(() => films.filter((f) => (f.rating == null ? includeUnrated : f.rating >= minRating)), [films, minRating, includeUnrated])
  const options = useMemo(() => {
    const sizes = SIZES.filter((n) => n <= eligible.length)
    const all = Math.min(eligible.length, MAX_ENTRANTS)
    if (all >= MIN_ENTRANTS && !sizes.includes(all)) sizes.push(all)
    return sizes
  }, [eligible.length])
  const count = options.includes(requested) ? requested : (options.filter((n) => n <= 16).at(-1) ?? options[0] ?? 0)

  // shuffleKey forces a new random draw / tie-break order.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seeds = useMemo(() => (count >= MIN_ENTRANTS ? seedFilms(eligible, count, mode) : []), [eligible, count, mode, shuffleKey])
  const byes = seeds.length ? 2 ** Math.ceil(Math.log2(seeds.length)) - seeds.length : 0

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Film tournament</h1>
        <p className="text-muted">
          Two films at a time: pick the one you'd rather keep. Your best-rated films are seeded so they meet as late as possible. Last film standing wins.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl bg-panel p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
        <label className="flex flex-col gap-1 text-muted">
          Films
          <select value={mode} onChange={(e) => setMode(e.target.value as SelectionMode)} className={inputClass}>
            <option value="top">My top-rated</option>
            <option value="random">Random selection</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-muted">
          Bracket size
          <select value={count} onChange={(e) => setRequested(Number(e.target.value))} className={inputClass} disabled={options.length === 0}>
            {options.map((n) => (
              <option key={n} value={n}>
                {SIZES.includes(n) ? `${n} films` : `All ${n} films`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-muted">
          <input type="checkbox" checked={includeUnrated} onChange={(e) => setIncludeUnrated(e.target.checked)} className="accent-lb-green" />
          Include unrated films
        </label>
      </div>

      {seeds.length < MIN_ENTRANTS ? (
        <p className="text-center text-muted">Not enough films match. Lower the minimum rating or include unrated films.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {seeds.length} films · {seeds.length - 1} matches
              {byes === 1 && ' · the top seed gets a first-round bye'}
              {byes > 1 && ` · the top ${byes} seeds get a first-round bye`}
            </p>
            {(mode === 'random' || seeds.length < eligible.length) && (
              <Button variant="ghost" onClick={() => setShuffleKey((k) => k + 1)}>
                {mode === 'random' ? '🎲 Draw again' : '🎲 Reshuffle ties'}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {seeds.slice(0, 16).map((film, i) => (
              <div key={film.id} className="relative">
                <PosterCard film={film} match={matches[film.id]} width={64} showRating />
                <span className="absolute top-0.5 left-0.5 rounded bg-black/80 px-1 text-[10px] font-bold">#{i + 1}</span>
              </div>
            ))}
            {seeds.length > 16 && <div className="flex h-24 items-center px-3 text-sm text-muted">+{seeds.length - 16} more</div>}
          </div>
          <Button variant="primary" className="w-full py-3 text-base" onClick={() => setTournament(createTournament(seeds))}>
            Start tournament
          </Button>
        </div>
      )}
    </div>
  )
}

function Choice({ film, seed, side, state, onPick }: { film: Film; seed: number; side: string; state: 'idle' | 'won' | 'lost'; onPick: () => void }) {
  const match = useStore((s) => s.matches[film.id])
  const poster = match?.status === 'matched' && match.posterPath ? posterUrl(match.posterPath, 'w500') : null
  return (
    <button
      type="button"
      onClick={onPick}
      // Keep both posters on screen: the width follows the viewport height.
      style={{ maxWidth: 'min(24rem, calc((100dvh - 300px) * 2 / 3))' }}
      className={`group relative flex w-full flex-col overflow-hidden rounded-xl bg-panel text-left transition duration-200 ${
        state === 'won' ? 'scale-[1.03] ring-4 ring-lb-green' : state === 'lost' ? 'scale-95 opacity-30' : 'hover:-translate-y-1 hover:ring-2 hover:ring-lb-green/60'
      }`}
    >
      <div className="relative aspect-[2/3] w-full bg-raised">
        {poster ? (
          <img src={poster} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <div className="flex size-full flex-col items-center justify-center p-4 text-center">
            <span className="text-xl font-bold">{film.name}</span>
            {film.year && <span className="text-muted">{film.year}</span>}
          </div>
        )}
        <span className="absolute top-2 left-2 rounded bg-black/80 px-2 py-0.5 text-xs font-bold">#{seed} seed</span>
        <span className="absolute top-2 right-2 hidden rounded bg-black/80 px-2 py-0.5 text-xs text-muted sm:block">{side}</span>
      </div>
      <div className="space-y-0.5 p-3">
        <p className="line-clamp-2 font-semibold sm:text-lg">{film.name}</p>
        <p className="text-sm text-muted">
          {film.year ?? ''} <span className="text-lb-green">{film.rating != null && stars(film.rating)}</span>
        </p>
      </div>
    </button>
  )
}

function MatchView({ tournament: t }: { tournament: Tournament }) {
  const setTournament = useStore((s) => s.setTournament)
  const [chosen, setChosen] = useState<string | null>(null)
  const current = currentMatch(t)!
  const [aId, bId] = entrants(t, current.round, current.match)
  const seedOf = useMemo(() => new Map(t.seeds.map((f, i) => [f.id, { film: f, seed: i + 1 }])), [t.seeds])
  const a = seedOf.get(aId!)!
  const b = seedOf.get(bId!)!

  // Position of this match among the ones actually played this round (byes don't count).
  const roundMatches = t.picks[current.round]
    .map((_, m) => m)
    .filter((m) => entrants(t, current.round, m).every(Boolean))
  const matchNumber = roundMatches.indexOf(current.match) + 1

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
  const total = playableMatchCount(t)

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <div className="space-y-2 text-center">
        <p className="text-sm tracking-widest text-lb-orange uppercase">{roundName(t.size, current.round)}</p>
        <h1 className="text-2xl font-bold">
          Match {matchNumber} of {roundMatches.length}
        </h1>
        <div className="mx-auto h-1.5 max-w-md overflow-hidden rounded-full bg-raised">
          <div className="h-full bg-lb-green transition-[width]" style={{ width: `${(t.history.length / total) * 100}%` }} />
        </div>
        <p className="text-xs text-muted">
          {t.history.length} / {total} matches played
        </p>
      </div>

      <div className="flex items-start justify-center gap-3 sm:gap-6">
        <Choice film={a.film} seed={a.seed} side="← or 1" state={state(a.film.id)} onPick={() => choose(a.film.id)} />
        <span className="mt-[30%] shrink-0 text-xl font-black text-muted sm:text-3xl">VS</span>
        <Choice film={b.film} seed={b.seed} side="→ or 2" state={state(b.film.id)} onPick={() => choose(b.film.id)} />
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
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const notify = useStore((s) => s.notify)
  const [exporting, setExporting] = useState(false)
  const seedOf = useMemo(() => new Map(t.seeds.map((f, i) => [f.id, { film: f, seed: i + 1 }])), [t.seeds])
  const winner = seedOf.get(champion(t)!)!
  const table = standings(t)
  const groups = [...new Set(table.map((s) => s.place))].map((place) => ({ place, entries: table.filter((s) => s.place === place) }))
  const topUpsets = upsets(t).slice(0, 3)
  const winnerMatch = matches[winner.film.id]
  const winnerPoster = winnerMatch?.status === 'matched' && winnerMatch.posterPath ? posterUrl(winnerMatch.posterPath, 'w500') : null

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
    <div className="mx-auto max-w-4xl space-y-8 py-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm tracking-widest text-[#ffd84a] uppercase">🏆 Champion</p>
        <div className="w-56 overflow-hidden rounded-xl shadow-2xl ring-4 ring-[#ffd84a] sm:w-64">
          {winnerPoster ? (
            <img src={winnerPoster} alt="" className="aspect-[2/3] w-full object-cover" />
          ) : (
            <PosterCard film={winner.film} match={winnerMatch} width={256} showRating={false} />
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{winner.film.name}</h1>
          <p className="text-muted">
            {winner.film.year} · #{winner.seed} seed · <span className="text-lb-green">{stars(winner.film.rating)}</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" disabled={exporting} onClick={() => void exportPng()}>
            {exporting ? 'Rendering…' : 'Download image'}
          </Button>
          <Button onClick={() => setTournament(createTournament(t.seeds))}>Replay same films</Button>
          <Button variant="ghost" onClick={() => setTournament(undo(t))}>
            ↶ Undo final pick
          </Button>
          <Button variant="ghost" onClick={() => setTournament(null)}>
            New tournament
          </Button>
        </div>
      </div>

      {topUpsets.length > 0 && (
        <div className="space-y-2 rounded-xl bg-panel p-4">
          <h2 className="font-semibold">Biggest upsets</h2>
          {topUpsets.map((u) => (
            <p key={`${u.round}-${u.winnerId}`} className="text-sm text-muted">
              <span className="text-text">
                #{seedOf.get(u.winnerId)!.seed} {seedOf.get(u.winnerId)!.film.name}
              </span>{' '}
              beat{' '}
              <span className="text-text">
                #{seedOf.get(u.loserId)!.seed} {seedOf.get(u.loserId)!.film.name}
              </span>{' '}
              ({roundName(t.size, u.round)})
            </p>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-semibold">Final standings</h2>
        {groups.map(({ place, entries }) => (
          <div key={place} className="flex gap-4">
            <span className="w-24 shrink-0 pt-1 text-sm font-semibold text-muted">{placeLabel(place)}</span>
            <div className="flex flex-wrap gap-1.5">
              {entries.map(({ filmId, seed }) => {
                const film = seedOf.get(filmId)!.film
                return (
                  <button key={filmId} type="button" onClick={() => setEditingFilm(film)} className="relative" title={`#${seed} seed`}>
                    <PosterCard film={film} match={matches[filmId]} width={place <= 2 ? 88 : 64} showRating={false} />
                    <span className="absolute top-0.5 left-0.5 rounded bg-black/80 px-1 text-[10px] font-bold">#{seed}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
