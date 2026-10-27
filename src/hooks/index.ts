import { useMemo, useSyncExternalStore } from 'react'
import { filterFilms, sourceFilms } from '../lib/filter'
import { useStore } from '../store/useStore'

/** False until the persisted state has been read back from IndexedDB. */
export function useHydrated() {
  return useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
  )
}

/** The films the tier list starts from (all watched, liked, or a list), before other filters. */
export function useSourceFilms() {
  const films = useStore((s) => s.films)
  const lists = useStore((s) => s.lists)
  const source = useStore((s) => s.filters.source ?? 'all')
  return useMemo(() => sourceFilms(films, lists, source), [films, lists, source])
}

/** Films that pass the current filters. */
export function useVisibleFilms() {
  const base = useSourceFilms()
  const filters = useStore((s) => s.filters)
  const matches = useStore((s) => s.matches)
  const credits = useStore((s) => s.credits)
  return useMemo(() => filterFilms(base, filters, matches, credits), [base, filters, matches, credits])
}
