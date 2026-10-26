import { useCallback } from 'react'
import { useRoom } from '../../store/useRoom'
import { useStore } from '../../store/useStore'

/** Display name for a member id, from whoever we know about. */
export function useNameOf() {
  const view = useRoom((s) => s.view)!
  const profile = useStore((s) => s.profile)
  return useCallback(
    (memberId: string) => {
      if (memberId === profile.memberId) return profile.name || 'You'
      const peer = Object.values(view.peers).find((p) => p.memberId === memberId)
      return peer?.name || view.state.members[memberId]?.name || 'Someone'
    },
    [view, profile],
  )
}
