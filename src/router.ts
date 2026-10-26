import { useSyncExternalStore } from 'react'

// Hash routes work on GitHub Pages without server-side rewrites and make room links shareable.
export type Route =
  | { page: 'tierlist' }
  | { page: 'rooms' }
  /** `password` comes from an invite link that includes it (`#/room/CODE?pw=…`). */
  | { page: 'room'; roomId: string; password?: string }
  | { page: 'tournament' }
  /** Read-only tier list encoded in the link itself. */
  | { page: 'view'; code: string }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (path[0] === 'rooms') return { page: 'rooms' }
  if (path[0] === 'room' && path[1]) {
    const [id, query = ''] = path[1].split('?')
    const password = new URLSearchParams(query).get('pw') ?? undefined
    return { page: 'room', roomId: decodeURIComponent(id).toLowerCase(), ...(password && { password }) }
  }
  if (path[0] === 'tournament') return { page: 'tournament' }
  if (path[0] === 'view' && path[1]) return { page: 'view', code: path[1] }
  return { page: 'tierlist' }
}

export function routeHref(route: Route): string {
  switch (route.page) {
    case 'rooms':
      return '#/rooms'
    case 'room':
      return `#/room/${encodeURIComponent(route.roomId)}${route.password ? `?pw=${encodeURIComponent(route.password)}` : ''}`
    case 'tournament':
      return '#/tournament'
    case 'view':
      return `#/view/${route.code}`
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
