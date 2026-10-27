import { textColorFor } from '../lib/export/canvas'
import type { Film, Match, Tier } from '../lib/types'
import { PosterCard } from './board/PosterCard'

interface Props {
  tiers: Tier[]
  filmById: Map<string, Film>
  matches: Record<string, Match>
  cardWidth?: number
  onFilmClick?: (film: Film) => void
  /** Wider label column with bigger text, for full-page lists. */
  large?: boolean
  /** Films shown faded (e.g. not in the other list being compared). */
  dimmed?: Set<string>
}

/** Read-only, compact tier list (used to compare boards side by side). */
export function StaticTierList({ tiers, filmById, matches, cardWidth = 40, onFilmClick, large = false, dimmed }: Props) {
  const rowHeight = Math.round(cardWidth * 1.5)
  return (
    <div className="overflow-hidden rounded-md border border-black bg-[#1a1a17]">
      {tiers.map((tier) => (
        <div key={tier.id} className="flex border-b border-black last:border-b-0">
          <div
            className={`flex shrink-0 items-center justify-center px-1 text-center leading-tight font-semibold break-words ${large ? 'w-20 text-lg sm:w-28 sm:text-xl' : 'w-12 text-xs'}`}
            style={{ background: tier.color, color: textColorFor(tier.color), minHeight: rowHeight }}
          >
            {tier.label}
          </div>
          <div className="flex flex-1 flex-wrap content-start gap-px p-px">
            {tier.filmIds.map((id) => {
              const film = filmById.get(id)
              if (!film) return null
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!onFilmClick}
                  onClick={() => onFilmClick?.(film)}
                  className={`disabled:cursor-default ${dimmed?.has(id) ? 'opacity-30' : ''}`}
                >
                  <PosterCard film={film} match={matches[id]} width={cardWidth} showRating={false} />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
