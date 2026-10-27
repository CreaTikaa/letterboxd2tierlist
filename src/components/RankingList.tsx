import type { Film, Match } from '../lib/types'
import { PosterCard } from './board/PosterCard'

interface Props {
  films: Film[]
  matches: Record<string, Match>
  onFilmClick?: (film: Film) => void
  /** Smaller posters, all the same size. */
  small?: boolean
  /** Ids of films to fade out. */
  dimmed?: Set<string>
}

/** A ranking as a numbered poster grid, best first (the top three a little bigger). */
export function RankingList({ films, matches, onFilmClick, small = false, dimmed }: Props) {
  return (
    <ol className={`flex flex-wrap ${small ? 'gap-0.5' : 'gap-2'}`}>
      {films.map((film, i) => (
        <li key={film.id} className={`relative ${dimmed?.has(film.id) ? 'opacity-30' : ''}`}>
          <button type="button" disabled={!onFilmClick} onClick={() => onFilmClick?.(film)} className="block disabled:cursor-default" title={`${i + 1}. ${film.name}`}>
            <PosterCard film={film} match={matches[film.id]} width={small ? 48 : i < 3 ? 112 : 72} showRating={false} />
          </button>
          <span className={`absolute top-1 left-1 rounded bg-black/80 px-1.5 font-bold ${i < 3 && !small ? 'text-sm' : 'text-[10px]'} ${i < 3 ? 'text-[#ffd84a]' : ''}`}>{i + 1}</span>
        </li>
      ))}
    </ol>
  )
}
