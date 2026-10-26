import { memberColor } from '../../lib/room/group'
import { useNameOf } from './useNameOf'

export function MemberTag({ memberId, suffix }: { memberId: string; suffix?: string }) {
  const nameOf = useNameOf()
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span className="size-2.5 rounded-full" style={{ background: memberColor(memberId) }} />
      {nameOf(memberId)}
      {suffix && <span className="font-normal text-muted">{suffix}</span>}
    </span>
  )
}
