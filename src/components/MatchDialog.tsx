import { useState } from 'react'
import { stars } from '../lib/ratings'
import { memberColor, type GroupFilm } from '../lib/room/group'
import type { Film } from '../lib/types'
import { useRoom } from '../store/useRoom'
import { getMovie, posterUrl, searchMovies, type TmdbMovie } from '../lib/tmdb/client'
import { releaseYear, toMatch } from '../lib/tmdb/match'
import { useStore } from '../store/useStore'
import { Button, Dialog, inputClass } from './ui'

/** Accepts "550", "https://www.themoviedb.org/movie/550-fight-club", etc. */
function parseTmdbId(text: string): number | null {
  const match = text.trim().match(/^(\d+)$|themoviedb\.org\/movie\/(\d+)/)
  return match ? Number(match[1] ?? match[2]) : null
}

/** Each room member's rating for a film. */
function GroupRatings({ film }: { film: GroupFilm }) {
  const members = useRoom((s) => s.view?.state.members ?? {})
  return (
    <div className="space-y-0.5">
      <p>
        Group average: <span className="text-lb-green">{film.average == null ? 'unrated' : `${film.average.toFixed(2)}★`}</span>
      </p>
      {Object.entries(film.ratings).map(([memberId, rating]) => (
        <p key={memberId} className="flex items-center gap-1.5 text-muted">
          <span className="size-2 rounded-full" style={{ background: memberColor(memberId) }} />
          {members[memberId]?.name ?? 'Someone'}: <span className="text-lb-green">{stars(rating)}</span>
        </p>
      ))}
    </div>
  )
}

export function MatchDialog() {
  const film = useStore((s) => s.editingFilm)
  // Keyed by film so the search form resets when another film is opened.
  return film ? <MatchContent key={film.id} film={film} /> : null
}

function MatchContent({ film }: { film: Film }) {
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const match = useStore((s) => s.matches[film.id])
  const tmdbKey = useStore((s) => s.tmdbKey)
  const setMatches = useStore((s) => s.setMatches)

  const [query, setQuery] = useState(film.name)
  const [results, setResults] = useState<TmdbMovie[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => setEditingFilm(null)

  const search = async () => {
    setBusy(true)
    setError(null)
    try {
      const id = parseTmdbId(query)
      setResults(id ? [await getMovie(tmdbKey, id)] : await searchMovies(tmdbKey, query))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  const choose = (movie: TmdbMovie) => {
    setMatches({ [film.id]: toMatch(movie, true) })
    close()
  }

  const current = match?.status === 'matched' ? match : null

  return (
    <Dialog open onClose={close} title="Film details" wide>
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="h-36 w-24 shrink-0 overflow-hidden rounded bg-raised">
            {current?.posterPath && <img src={posterUrl(current.posterPath, 'w185')} alt="" className="size-full object-cover" />}
          </div>
          <div className="min-w-0 space-y-1 text-sm">
            <p className="text-lg font-semibold text-text">
              {film.name} {film.year && <span className="font-normal text-muted">({film.year})</span>}
            </p>
            {'ratings' in film ? <GroupRatings film={film as GroupFilm} /> : <p className="text-lb-green">{stars(film.rating)}</p>}
            {film.uri && (
              <a href={film.uri} target="_blank" rel="noreferrer" className="block text-lb-blue hover:underline">
                Open on Letterboxd ↗
              </a>
            )}
            <p className="text-muted">
              TMDB match:{' '}
              {current ? (
                <a href={`https://www.themoviedb.org/movie/${current.tmdbId}`} target="_blank" rel="noreferrer" className="text-text hover:underline">
                  {current.title} {current.year && `(${current.year})`}
                </a>
              ) : match?.status === 'notfound' ? (
                'not found'
              ) : (
                'not looked up yet'
              )}
              {current?.manual && ' · picked by hand'}
            </p>
          </div>
        </div>

        {tmdbKey ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Wrong poster? Pick the right film:</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void search()
              }}
            >
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, TMDB id or TMDB URL" className={`${inputClass} min-w-0 flex-1`} />
              <Button type="submit" variant="primary" disabled={busy || !query.trim()}>
                {busy ? 'Searching…' : 'Search'}
              </Button>
            </form>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {results && results.length === 0 && <p className="text-sm text-muted">No results.</p>}
            {results && results.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {results.slice(0, 15).map((movie) => (
                  <button key={movie.id} type="button" onClick={() => choose(movie)} className="group space-y-1 text-left" title="Use this film">
                    <div className="aspect-[2/3] overflow-hidden rounded bg-raised ring-lb-green group-hover:ring-2">
                      {movie.poster_path ? (
                        <img src={posterUrl(movie.poster_path, 'w185')} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center p-1 text-center text-xs text-muted">No poster</div>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs">
                      {movie.title} <span className="text-muted">{releaseYear(movie) ?? ''}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setMatches({ [film.id]: { status: 'notfound' } })
                close()
              }}
            >
              Use a title card instead of a poster
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Add a TMDB key in Settings to search for posters.</p>
        )}
      </div>
    </Dialog>
  )
}
