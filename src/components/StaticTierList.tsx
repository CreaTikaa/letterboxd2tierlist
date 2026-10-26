import { textColorFor } from '../lib/export/canvas'
import type { Film, Match, Tier } from '../lib/types'
import { PosterCard } from './board/PosterCard'

interface Props {
  tiers: Tier[]
  filmById: Map<string, Film>
  matches: Record<string, Match>
  cardWidth?: number
  onFilmClick?: (film: Film) => void
}

/** Read-only, compact tier list (used to compare boards side by side). */
export function StaticTierList({ tiers, filmById, matches, cardWidth = 40, onFilmClick }: Props) {
  const rowHeight = Math.round(cardWidth * 1.5)
  return (
    <div className="overflow-hidden rounded-md border border-black bg-[#1a1a17]">
      {tiers.map((tier) => (
        <div key={tier.id} className="flex border-b border-black last:border-b-0">
          <div
            className="flex w-12 shrink-0 items-center justify-center px-1 text-center text-xs leading-tight font-semibold break-words"
            style={{ background: tier.color, color: textColorFor(tier.color), minHeight: rowHeight }}
          >
            {tier.label}
          </div>
          <div className="flex flex-1 flex-wrap content-start gap-px p-px">
            {tier.filmIds.map((id) => {
              const film = filmById.get(id)
              if (!film) return null
              return (
                <button key={id} type="button" onClick={() => onFilmClick?.(film)} className="cursor-pointer">
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
