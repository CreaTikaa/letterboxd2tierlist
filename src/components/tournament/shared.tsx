import { useMemo, type ReactNode } from 'react'
import { genreLabel, useLocale, useT } from '../../i18n'
import { Trans } from '../../i18n/Trans'
import { useTournamentText } from '../../i18n/tournamentText'
import { countByGenre } from '../../lib/filter'
import { ratingText, stars } from '../../lib/ratings'
import { posterUrl } from '../../lib/tmdb/client'
import {
  BRACKET_SIZES,
  MIN_ENTRANTS,
  champion,
  entrants,
  playableMatchCount,
  standings,
  upsets,
  type SelectionMode,
  type Tournament,
} from '../../lib/tournament'
import type { Film, Match } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { PosterCard } from '../board/PosterCard'
import { Button, inputClass } from '../ui'
import { BracketView } from './BracketView'
import { useSeedLookup } from './useSeedLookup'

export function BracketSizeSelect({ value, options, onChange }: { value: number; options: number[]; onChange: (size: number) => void }) {
  const t = useT()
  return (
    <label className="flex flex-col gap-1 text-muted">
      {t('tournament.bracketSize')}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass} disabled={options.length === 0}>
        {options.map((n) => (
          <option key={n} value={n}>
            {BRACKET_SIZES.includes(n) ? t('tournament.sizeOption', { count: n }) : t('tournament.sizeAll', { count: n })}
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
  const t = useT()
  if (counts.length === 0) return null
  return (
    <label className="flex flex-col gap-1 text-muted">
      {t('tournament.genre')}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass}>
        <option value={0}>{t('tournament.anyGenre')}</option>
        {counts.map(([genre, count]) => (
          <option key={genre} value={genre}>
            {t('tournament.genreOption', { genre: genreLabel(t, genre), count })}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SelectionModeSelect({ value, onChange, topLabel }: { value: SelectionMode; onChange: (mode: SelectionMode) => void; topLabel: string }) {
  const t = useT()
  return (
    <label className="flex flex-col gap-1 text-muted">
      {t('tournament.films')}
      <select value={value} onChange={(e) => onChange(e.target.value as SelectionMode)} className={inputClass}>
        <option value="top">{topLabel}</option>
        <option value="random">{t('tournament.random')}</option>
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

export function SeedPreview({ seeds, eligibleCount, mode, onReshuffle, onStart, startLabel, emptyMessage }: SeedPreviewProps) {
  const matches = useStore((s) => s.matches)
  const t = useT()
  const locale = useLocale()
  if (seeds.length < MIN_ENTRANTS) return <p className="text-center text-muted">{emptyMessage}</p>
  const byes = 2 ** Math.ceil(Math.log2(seeds.length)) - seeds.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {t('tournament.summary', { films: t('common.films', { count: seeds.length }), matches: t('tournament.matches', { count: seeds.length - 1 }) })}
          {byes === 1 && t('tournament.byeOne')}
          {byes > 1 && t('tournament.byes', { count: byes })}
        </p>
        {(mode === 'random' || seeds.length < eligibleCount) && (
          <Button variant="ghost" onClick={onReshuffle}>
            {mode === 'random' ? t('tournament.drawAgain') : t('tournament.reshuffle')}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {seeds.slice(0, 16).map((film, i) => (
          <div key={film.id} className="relative" title={`#${i + 1} · ${film.name} · ${ratingText(film.rating, locale) || t('common.unrated')}`}>
            <PosterCard film={film} match={matches[film.id]} width={64} showRating badge={(f) => ratingText(f.rating, locale) || t('common.unrated')} />
            <span className="absolute top-0.5 left-0.5 rounded bg-black/80 px-1 text-[10px] font-bold">#{i + 1}</span>
          </div>
        ))}
        {seeds.length > 16 && <div className="flex h-24 items-center px-3 text-sm text-muted">+{seeds.length - 16} more</div>}
      </div>
      <Button variant="primary" className="w-full py-3 text-base" onClick={onStart}>
        {startLabel ?? t('tournament.start')}
      </Button>
    </div>
  )
}

export type CardState = 'idle' | 'selected' | 'won' | 'lost'

interface MatchupCardProps {
  film: Film
  /** Shown as a badge in tournaments. */
  seed?: number
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
  const t = useT()
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
        {seed != null && <span className="absolute top-2 left-2 rounded bg-black/80 px-2 py-0.5 text-xs font-bold">{t('tournament.seed', { seed })}</span>}
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
export function MatchHeader({ tournament: bracket, round, match }: { tournament: Tournament; round: number; match: number }) {
  const t = useT()
  const { roundLabel } = useTournamentText()
  const roundMatches = bracket.picks[round].map((_, m) => m).filter((m) => entrants(bracket, round, m).every(Boolean))
  const total = playableMatchCount(bracket)
  return (
    <div className="space-y-2 text-center">
      <p className="text-sm tracking-widest text-lb-orange uppercase">{roundLabel(bracket.size, round)}</p>
      <h1 className="text-2xl font-bold">{t('tournament.matchOf', { n: roundMatches.indexOf(match) + 1, total: roundMatches.length })}</h1>
      <div className="mx-auto h-1.5 max-w-md overflow-hidden rounded-full bg-raised">
        <div className="h-full bg-lb-green transition-[width]" style={{ width: `${(bracket.history.length / total) * 100}%` }} />
      </div>
      <p className="text-xs text-muted">{t('tournament.played', { played: bracket.history.length, total })}</p>
    </div>
  )
}

/** Champion, upsets and final standings. `actions` go under the champion; `children` at the end. */
export function TournamentResults({
  tournament: bracket,
  actions,
  children,
  matches: matchesOverride,
  readOnly = false,
}: {
  tournament: Tournament
  actions: ReactNode
  children?: ReactNode
  /** Posters for a shared bracket (instead of your own cache). */
  matches?: Record<string, Match>
  /** Shared view: posters aren't clickable. */
  readOnly?: boolean
}) {
  const ownMatches = useStore((s) => s.matches)
  const matches = matchesOverride ?? ownMatches
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const t = useT()
  const locale = useLocale()
  const { roundLabel, placeLabel } = useTournamentText()
  const seedOf = useSeedLookup(bracket)
  const winner = seedOf.get(champion(bracket)!)!
  const table = standings(bracket)
  const groups = [...new Set(table.map((s) => s.place))].map((place) => ({ place, entries: table.filter((s) => s.place === place) }))
  const topUpsets = upsets(bracket).slice(0, 3)
  const winnerMatch = matches[winner.film.id]
  const winnerPoster = winnerMatch?.status === 'matched' && winnerMatch.posterPath ? posterUrl(winnerMatch.posterPath, 'w500') : null

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm tracking-widest text-[#ffd84a] uppercase">{t('tournament.championHeading')}</p>
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
            {winner.film.year} · {t('tournament.seed', { seed: winner.seed })} ·{' '}
            <span className="text-lb-green">{ratingText(winner.film.rating, locale) || t('common.unrated')}</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">{actions}</div>
      </div>

      {topUpsets.length > 0 && (
        <div className="space-y-2 rounded-xl bg-panel p-4">
          <h2 className="font-semibold">{t('tournament.upsets')}</h2>
          {topUpsets.map((u) => (
            <p key={`${u.round}-${u.winnerId}`} className="text-sm text-muted">
              <Trans
                k="tournament.upset"
                params={{
                  winner: `#${seedOf.get(u.winnerId)!.seed} ${seedOf.get(u.winnerId)!.film.name}`,
                  loser: `#${seedOf.get(u.loserId)!.seed} ${seedOf.get(u.loserId)!.film.name}`,
                  round: roundLabel(bracket.size, u.round),
                }}
                tags={{ b: (text) => <span className="text-text">{text}</span> }}
              />
            </p>
          ))}
        </div>
      )}

      {children}

      <div className="space-y-4">
        <h2 className="font-semibold">{t('tournament.standings')}</h2>
        {groups.map(({ place, entries }) => (
          <div key={place} className="flex gap-4">
            <span className="w-24 shrink-0 pt-1 text-sm font-semibold text-muted">{placeLabel(place)}</span>
            <div className="flex flex-wrap gap-1.5">
              {entries.map(({ filmId, seed }) => {
                const film = seedOf.get(filmId)!.film
                return (
                  <button
                    key={filmId}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setEditingFilm(film)}
                    className="relative disabled:cursor-default"
                    title={`${film.name} · ${t('tournament.seed', { seed })}`}
                  >
                    <PosterCard film={film} match={matches[filmId]} width={place <= 2 ? 88 : 64} showRating={false} />
                    <span className="absolute top-0.5 left-0.5 rounded bg-black/80 px-1 text-[10px] font-bold">#{seed}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <details className="rounded-xl bg-panel/50 p-4">
        <summary className="cursor-pointer font-semibold">{t('bracket.title')}</summary>
        <div className="mt-3">
          <BracketView bracket={bracket} matches={matches} />
        </div>
      </details>
    </div>
  )
}
