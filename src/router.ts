import { useSyncExternalStore } from 'react'

// Hash routes work on GitHub Pages without server-side rewrites and make room links shareable.
export type Route = { page: 'tierlist' } | { page: 'rooms' } | { page: 'room'; roomId: string } | { page: 'tournament' }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (path[0] === 'rooms') return { page: 'rooms' }
  if (path[0] === 'room' && path[1]) return { page: 'room', roomId: decodeURIComponent(path[1]).toLowerCase() }
  if (path[0] === 'tournament') return { page: 'tournament' }
  return { page: 'tierlist' }
}

export function routeHref(route: Route): string {
  switch (route.page) {
    case 'rooms':
      return '#/rooms'
    case 'room':
      return `#/room/${encodeURIComponent(route.roomId)}`
    case 'tournament':
      return '#/tournament'
    default:
      return '#/'
  }
}

export function navigate(route: Route) {
  window.location.hash = routeHref(route)
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}
