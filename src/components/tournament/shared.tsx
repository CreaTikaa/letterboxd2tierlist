import { useMemo, type ReactNode } from 'react'
import { countByGenre } from '../../lib/filter'
import { genreName } from '../../lib/genres'
import { ratingText, stars } from '../../lib/ratings'
import { posterUrl } from '../../lib/tmdb/client'
import {
  BRACKET_SIZES,
  MIN_ENTRANTS,
  champion,
  entrants,
  placeLabel,
  playableMatchCount,
  roundName,
  standings,
  upsets,
  type SelectionMode,
  type Tournament,
} from '../../lib/tournament'
import type { Film } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { PosterCard } from '../board/PosterCard'
import { Button, inputClass } from '../ui'
import { useSeedLookup } from './useSeedLookup'

export function BracketSizeSelect({ value, options, onChange }: { value: number; options: number[]; onChange: (size: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-muted">
      Bracket size
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass} disabled={options.length === 0}>
        {options.map((n) => (
          <option key={n} value={n}>
            {BRACKET_SIZES.includes(n) ? `${n} films` : `All ${n} films`}
          </option>
        ))}
      </select>
    </label>
  )
}

/** "Any genre" or one genre present among `films` (0 = any). Hidden until posters (and genres) are loaded. */
export function GenreSelect({ films, value, onChange }: { films: Film[]; value: number; onChange: (genre: number) => void }) {
  const matches = useStore((s) => s.matches)
  const counts = useMemo(() => [...countByGenre(films, matches)].sort((a, b) => b[1] - a[1]), [films, matches])
  if (counts.length === 0) return null
  return (
    <label className="flex flex-col gap-1 text-muted">
      Genre
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass}>
        <option value={0}>Any genre</option>
        {counts.map(([genre, count]) => (
          <option key={genre} value={genre}>
            {genreName(genre)} ({count})
          </option>
        ))}
      </select>
    </label>
  )
}

export function SelectionModeSelect({ value, onChange, topLabel }: { value: SelectionMode; onChange: (mode: SelectionMode) => void; topLabel: string }) {
  return (
    <label className="flex flex-col gap-1 text-muted">
      Films
      <select value={value} onChange={(e) => onChange(e.target.value as SelectionMode)} className={inputClass}>
        <option value="top">{topLabel}</option>
        <option value="random">Random selection</option>
      </select>
    </label>
  )
}

interface SeedPreviewProps {
  seeds: Film[]
  eligibleCount: number
  mode: SelectionMode
  onReshuffle: () => void
  onStart: () => void
  startLabel?: string
  emptyMessage: string
}

export function SeedPreview({ seeds, eligibleCount, mode, onReshuffle, onStart, startLabel = 'Start tournament', emptyMessage }: SeedPreviewProps) {
  const matches = useStore((s) => s.matches)
  if (seeds.length < MIN_ENTRANTS) return <p className="text-center text-muted">{emptyMessage}</p>
  const byes = 2 ** Math.ceil(Math.log2(seeds.length)) - seeds.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {seeds.length} films · {seeds.length - 1} matches
          {byes === 1 && ' · the top seed gets a first-round bye'}
          {byes > 1 && ` · the top ${byes} seeds get a first-round bye`}
        </p>
        {(mode === 'random' || seeds.length < eligibleCount) && (
          <Button variant="ghost" onClick={onReshuffle}>
            {mode === 'random' ? '🎲 Draw again' : '🎲 Reshuffle ties'}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {seeds.slice(0, 16).map((film, i) => (
          <div key={film.id} className="relative" title={`#${i + 1} · ${film.name} · ${ratingText(film.rating)}`}>
            <PosterCard film={film} match={matches[film.id]} width={64} showRating badge={(f) => ratingText(f.rating)} />
            <span className="absolute top-0.5 left-0.5 rounded bg-black/80 px-1 text-[10px] font-bold">#{i + 1}</span>
          </div>
        ))}
        {seeds.length > 16 && <div className="flex h-24 items-center px-3 text-sm text-muted">+{seeds.length - 16} more</div>}
      </div>
      <Button variant="primary" className="w-full py-3 text-base" onClick={onStart}>
        {startLabel}
      </Button>
    </div>
  )
}

export type CardState = 'idle' | 'selected' | 'won' | 'lost'

interface MatchupCardProps {
  film: Film
  seed: number
  state: CardState
  onPick: () => void
  /** Small label in the top-right corner (e.g. the keyboard shortcut). */
  hint?: string
  subtitle?: ReactNode
  footer?: ReactNode
  disabled?: boolean
}

export function MatchupCard({ film, seed, state, onPick, hint, subtitle, footer, disabled }: MatchupCardProps) {
  const match = useStore((s) => s.matches[film.id])
  const poster = match?.status === 'matched' && match.posterPath ? posterUrl(match.posterPath, 'w500') : null
  const look = {
    idle: 'hover:-translate-y-1 hover:ring-2 hover:ring-lb-green/60',
    selected: 'ring-4 ring-lb-blue',
    won: 'scale-[1.03] ring-4 ring-lb-green',
    lost: 'scale-95 opacity-30',
  }[state]
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      // Keep both posters on screen: the width follows the viewport height.
      style={{ maxWidth: 'min(24rem, calc((100dvh - 320px) * 2 / 3))' }}
      className={`group relative flex w-full flex-col overflow-hidden rounded-xl bg-panel text-left transition duration-200 disabled:cursor-default ${look}`}
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
        {hint && <span className="absolute top-2 right-2 hidden rounded bg-black/80 px-2 py-0.5 text-xs text-muted sm:block">{hint}</span>}
      </div>
      <div className="space-y-0.5 p-3">
        <p className="line-clamp-2 font-semibold sm:text-lg">{film.name}</p>
        <p className="text-sm text-muted">
          {film.year ?? ''} {subtitle ?? <span className="text-lb-green">{film.rating != null && stars(film.rating)}</span>}
        </p>
        {footer}
      </div>
    </button>
  )
}

/** Round name, match number within the round (byes excluded) and overall progress. */
export function MatchHeader({ tournament: t, round, match }: { tournament: Tournament; round: number; match: number }) {
  const roundMatches = t.picks[round].map((_, m) => m).filter((m) => entrants(t, round, m).every(Boolean))
  const total = playableMatchCount(t)
  return (
    <div className="space-y-2 text-center">
      <p className="text-sm tracking-widest text-lb-orange uppercase">{roundName(t.size, round)}</p>
      <h1 className="text-2xl font-bold">
        Match {roundMatches.indexOf(match) + 1} of {roundMatches.length}
      </h1>
      <div className="mx-auto h-1.5 max-w-md overflow-hidden rounded-full bg-raised">
        <div className="h-full bg-lb-green transition-[width]" style={{ width: `${(t.history.length / total) * 100}%` }} />
      </div>
      <p className="text-xs text-muted">
        {t.history.length} / {total} matches played
      </p>
    </div>
  )
}

/** Champion, upsets and final standings. `actions` go under the champion; `children` at the end. */
export function TournamentResults({ tournament: t, actions, children }: { tournament: Tournament; actions: ReactNode; children?: ReactNode }) {
  const matches = useStore((s) => s.matches)
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const seedOf = useSeedLookup(t)
  const winner = seedOf.get(champion(t)!)!
  const table = standings(t)
  const groups = [...new Set(table.map((s) => s.place))].map((place) => ({ place, entries: table.filter((s) => s.place === place) }))
  const topUpsets = upsets(t).slice(0, 3)
  const winnerMatch = matches[winner.film.id]
  const winnerPoster = winnerMatch?.status === 'matched' && winnerMatch.posterPath ? posterUrl(winnerMatch.posterPath, 'w500') : null

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
            {winner.film.year} · #{winner.seed} seed · <span className="text-lb-green">{ratingText(winner.film.rating)}</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">{actions}</div>
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

      {children}

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
