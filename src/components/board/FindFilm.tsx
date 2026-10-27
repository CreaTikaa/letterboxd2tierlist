import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useT } from '../../i18n'
import { findFilms } from '../../lib/filter'
import { posterUrl } from '../../lib/tmdb/client'
import type { Film, Match, Tier } from '../../lib/types'
import { inputClass } from '../ui'

interface Props {
  films: Film[]
  tiers: Tier[]
  matches: Record<string, Match>
  onPick: (film: Film) => void
}

/**
 * Finds a film on the board and says where it sits. The browser's own find can't read posters,
 * so Ctrl+F (⌘F) lands here instead.
 */
export function FindFilm({ films, tiers, matches, onPick }: Props) {
  const t = useT()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const results = useMemo(() => findFilms(films, query), [films, query])
  const tierOf = useMemo(() => new Map(tiers.flatMap((tier) => tier.filmIds.map((id) => [id, tier] as const))), [tiers])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return
      e.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const close = () => {
    setQuery('')
    setOpen(false)
    input.current?.blur()
  }
  const pick = (film: Film) => {
    close()
    onPick(film)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, results.length - 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
    else if (e.key === 'Enter' && results[active]) pick(results[active])
    else if (e.key === 'Escape') close()
    else return
    e.preventDefault()
  }

  const showList = open && query.trim() !== ''

  return (
    <div className="relative">
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label={t('find.label')}
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        placeholder={t('find.placeholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={`${inputClass} w-52`}
      />
      {showList && (
        // Keep the input focused while clicking a result.
        <ul
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-0 z-40 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-2xl"
        >
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t('find.none')}</li>}
          {results.map((film, i) => {
            const match = matches[film.id]
            const poster = match?.status === 'matched' && match.posterPath ? posterUrl(match.posterPath, 'w92') : null
            const tier = tierOf.get(film.id)
            return (
              <li
                key={film.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onClick={() => pick(film)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-sm ${i === active ? 'bg-raised' : ''}`}
              >
                <span className="h-9 w-6 shrink-0 overflow-hidden rounded-sm bg-raised">{poster && <img src={poster} alt="" className="size-full object-cover" />}</span>
                <span className="min-w-0 flex-1 truncate">
                  {film.name} {film.year && <span className="text-muted">{film.year}</span>}
                </span>
                {tier ? (
                  <span className="max-w-24 shrink-0 truncate rounded px-1.5 py-0.5 text-xs font-bold text-ink" style={{ background: tier.color }}>
                    {tier.label || '·'}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted">{t('pool.title')}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
