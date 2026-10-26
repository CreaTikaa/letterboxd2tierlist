import { useRef, useState } from 'react'
import { memberColor } from '../../lib/room/group'
import type { Film } from '../../lib/types'
import { importFromFiles } from '../../store/importFromFiles'
import { useRoom } from '../../store/useRoom'
import { useStore } from '../../store/useStore'
import { Button } from '../ui'

interface Person {
  memberId: string
  name: string
  online: boolean
  films: number | null
}

/** Only what the room needs; keeps messages small. */
const shareable = (films: Film[]): Film[] => films.map(({ id, name, year, uri, rating }) => ({ id, name, year, uri, rating, watchedDate: null }))

export function MembersPanel() {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const profile = useStore((s) => s.profile)
  const library = useStore((s) => s.films)
  const inputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const { members } = view.state
  const people = new Map<string, Person>()
  for (const member of Object.values(members)) people.set(member.id, { memberId: member.id, name: member.name, online: false, films: member.films.length })
  for (const peer of Object.values(view.peers)) {
    const existing = people.get(peer.memberId)
    people.set(peer.memberId, { memberId: peer.memberId, name: peer.name, online: true, films: existing?.films ?? null })
  }
  const mine = members[profile.memberId]
  people.set(profile.memberId, { memberId: profile.memberId, name: profile.name, online: true, films: mine?.films.length ?? null })

  const share = (films: Film[] = library) => dispatch({ t: 'member', member: { id: profile.memberId, name: profile.name, films: shareable(films) } })

  const importAndShare = async (files: File[]) => {
    setImporting(true)
    if (await importFromFiles(files)) share(useStore.getState().films)
    setImporting(false)
  }

  const sorted = [...people.values()].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))

  return (
    <div className="space-y-3 rounded-xl bg-panel p-4">
      <div className="flex flex-wrap gap-2">
        {sorted.map((person) => (
          <div key={person.memberId} className={`flex items-center gap-2 rounded-full bg-ink py-1 pr-3 pl-1 text-sm ${person.online ? '' : 'opacity-50'}`}>
            <span className="flex size-6 items-center justify-center rounded-full text-xs font-bold text-ink" style={{ background: memberColor(person.memberId) }}>
              {(person.name || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="font-medium">
              {person.name || 'Anonymous'}
              {person.memberId === profile.memberId && <span className="text-muted"> (you)</span>}
            </span>
            {view.hostMemberId === person.memberId && <span className="rounded bg-raised px-1.5 text-[10px] tracking-wide text-muted uppercase">host</span>}
            <span className="text-xs text-muted">{person.films == null ? 'no films yet' : `${person.films} films`}</span>
            <span className={`size-2 rounded-full ${person.online ? 'bg-lb-green' : 'bg-line'}`} title={person.online ? 'Online' : 'Offline'} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {library.length === 0 ? (
          <>
            <span className="text-muted">Import your Letterboxd export to add your films:</span>
            <Button variant="primary" disabled={importing} onClick={() => inputRef.current?.click()}>
              {importing ? 'Reading…' : 'Import & share'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.csv"
              multiple
              hidden
              onChange={(e) => {
                void importAndShare([...(e.target.files ?? [])])
                e.target.value = ''
              }}
            />
          </>
        ) : !mine ? (
          <>
            <span className="text-muted">Your ratings are visible to everyone in the room once shared.</span>
            <Button variant="primary" onClick={() => share()}>
              Share my {library.length} films
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted">You're sharing {mine.films.length} films.</span>
            {mine.films.length !== library.length && (
              <Button onClick={() => share()} title="Your library changed since you shared it">
                Update to {library.length} films
              </Button>
            )}
            <Button variant="ghost" onClick={() => confirm('Remove your films from this room?') && dispatch({ t: 'member-remove', memberId: profile.memberId })}>
              Remove my films
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
