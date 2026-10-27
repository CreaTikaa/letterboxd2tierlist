import type { Film, Match } from '../lib/types'
import { PosterCard } from './board/PosterCard'

/** A ranking as a numbered poster grid, best first (the top three a little bigger). */
export function RankingList({ films, matches, onFilmClick }: { films: Film[]; matches: Record<string, Match>; onFilmClick?: (film: Film) => void }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {films.map((film, i) => (
        <li key={film.id} className="relative">
          <button type="button" disabled={!onFilmClick} onClick={() => onFilmClick?.(film)} className="block disabled:cursor-default" title={`${i + 1}. ${film.name}`}>
            <PosterCard film={film} match={matches[film.id]} width={i < 3 ? 112 : 72} showRating={false} />
          </button>
          <span className={`absolute top-1 left-1 rounded bg-black/80 px-1.5 font-bold ${i < 3 ? 'text-sm text-[#ffd84a]' : 'text-[10px]'}`}>{i + 1}</span>
        </li>
      ))}
    </ol>
  )
}
