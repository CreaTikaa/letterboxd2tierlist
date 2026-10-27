import { useMemo, useState } from 'react'
import { useT } from '../i18n'
import { peopleIndex } from '../lib/filter'
import type { Film } from '../lib/types'
import { loadCredits } from '../store/credits'
import { useStore } from '../store/useStore'
import { inputClass } from './ui'

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Pick a director or actor among the given films. Cast & crew load the first time it's used. */
export function PeopleFilter({ films, value, onChange }: { films: Film[]; value: number | null; onChange: (person: number | null) => void }) {
  const t = useT()
  const matches = useStore((s) => s.matches)
  const credits = useStore((s) => s.credits)
  const progress = useStore((s) => s.creditsProgress)
  const tmdbKey = useStore((s) => s.tmdbKey)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const people = useMemo(() => peopleIndex(films, matches, credits), [films, matches, credits])
  const suggestions = useMemo(() => {
    const q = normalize(query.trim())
    return people
      .filter((p) => !q || normalize(p.name).includes(q))
      .sort((a, b) => b.directed * 3 + b.acted - (a.directed * 3 + a.acted) || a.name.localeCompare(b.name))
      .slice(0, 8)
  }, [people, query])

  if (value != null) {
    const person = people.find((p) => p.id === value)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-lb-blue/60 bg-lb-blue/15 py-0.5 pr-1 pl-2.5 text-xs">
        🎬 {person?.name ?? '…'}
        <button type="button" onClick={() => onChange(null)} className="rounded-full px-1 text-muted hover:text-text" aria-label={t('people.clear')} title={t('people.clear')}>
          ✕
        </button>
      </span>
    )
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        disabled={!tmdbKey}
        title={tmdbKey ? undefined : t('people.needKey')}
        placeholder={t('people.placeholder')}
        aria-label={t('people.label')}
        onFocus={() => {
          setOpen(true)
          void loadCredits(films)
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => setQuery(e.target.value)}
        className={`${inputClass} w-48 disabled:opacity-50`}
      />
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-72 overflow-hidden rounded-lg border border-line bg-panel shadow-2xl">
          {progress && <p className="px-3 py-2 text-xs text-muted">{t('people.loading', { done: progress.done, total: progress.total })}</p>}
          {suggestions.map((person) => (
            <button
              key={person.id}
              type="button"
              // mousedown runs before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(person.id)
                setQuery('')
                setOpen(false)
              }}
              className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-raised"
            >
              <span className="truncate">{person.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {[person.directed ? t('people.directed', { count: person.directed }) : '', person.acted ? t('people.acted', { count: person.acted }) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          ))}
          {!progress && suggestions.length === 0 && <p className="px-3 py-2 text-xs text-muted">{t('people.noMatch')}</p>}
        </div>
      )}
    </div>
  )
}
