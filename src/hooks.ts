import { useMemo, useSyncExternalStore } from 'react'
import { filterFilms } from './lib/filter'
import { useStore } from './store/useStore'

/** False until the persisted state has been read back from IndexedDB. */
export function useHydrated() {
  return useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
  )
}

/** Films that pass the current filters. */
export function useVisibleFilms() {
  const films = useStore((s) => s.films)
  const filters = useStore((s) => s.filters)
  const matches = useStore((s) => s.matches)
  return useMemo(() => filterFilms(films, filters, matches), [films, filters, matches])
}
