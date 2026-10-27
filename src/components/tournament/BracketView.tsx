import { useT } from '../../i18n'
import { useTournamentText } from '../../i18n/tournamentText'
import { posterUrl } from '../../lib/tmdb/client'
import { champion, entrants, type Tournament } from '../../lib/tournament'
import type { Film, Match } from '../../lib/types'
import { useSeedLookup } from './useSeedLookup'

interface EntrantProps {
  id: string | null
  won: boolean
  decided: boolean
  seedOf: Map<string, { film: Film; seed: number }>
  matches: Record<string, Match>
  byeLabel: string
}

function Entrant({ id, won, decided, seedOf, matches, byeLabel }: EntrantProps) {
  if (!id) return <div className="px-2 py-1 text-muted italic">{byeLabel}</div>
  const entry = seedOf.get(id)
  const match = matches[id]
  const poster = match?.status === 'matched' && match.posterPath ? posterUrl(match.posterPath, 'w92') : null
  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-1 ${won ? 'font-semibold text-lb-green' : decided ? 'text-muted' : ''}`}>
      <span className="h-6 w-4 shrink-0 overflow-hidden rounded-sm bg-raised">{poster && <img src={poster} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}</span>
      <span className="w-5 shrink-0 text-right text-[10px] text-muted">#{entry?.seed}</span>
      <span className="truncate">{entry?.film.name}</span>
    </div>
  )
}

/** The whole bracket, one column per round (scrolls sideways on small screens). */
export function BracketView({ bracket, matches }: { bracket: Tournament; matches: Record<string, Match> }) {
  const t = useT()
  const { roundLabel } = useTournamentText()
  const seedOf = useSeedLookup(bracket)
  const winner = champion(bracket)
  const common = { seedOf, matches, byeLabel: t('bracket.bye') }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {bracket.picks.map((round, r) => (
          <div key={r} className="flex w-48 flex-col">
            <p className="mb-2 text-center text-[11px] tracking-wide text-muted uppercase">{roundLabel(bracket.size, r)}</p>
            <div className="flex flex-1 flex-col justify-around gap-2">
              {round.map((pickId, m) => {
                const [a, b] = entrants(bracket, r, m)
                return (
                  <div key={m} className="divide-y divide-line overflow-hidden rounded-md border border-line bg-panel text-xs">
                    <Entrant id={a} won={pickId != null && pickId === a} decided={pickId != null} {...common} />
                    <Entrant id={b} won={pickId != null && pickId === b} decided={pickId != null} {...common} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {winner && (
          <div className="flex w-40 flex-col">
            <p className="mb-2 text-center text-[11px] tracking-wide text-[#ffd84a] uppercase">{t('tournament.championHeading')}</p>
            <div className="flex flex-1 flex-col justify-around">
              <div className="rounded-md border border-[#ffd84a]/60 bg-panel text-xs">
                <Entrant id={winner} won decided {...common} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
