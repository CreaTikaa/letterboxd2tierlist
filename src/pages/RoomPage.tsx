import { useEffect, useState } from 'react'
import { GroupBoard } from '../components/room/GroupBoard'
import { MembersPanel } from '../components/room/MembersPanel'
import { RoomTournament } from '../components/room/RoomTournament'
import { Showdown } from '../components/room/Showdown'
import { Button, inputClass } from '../components/ui'
import { currentMatchKey } from '../lib/room/groupTournament'
import { navigate } from '../router'
import { useRoom } from '../store/useRoom'
import { useStore } from '../store/useStore'

function NamePrompt({ roomId }: { roomId: string }) {
  const setName = useStore((s) => s.setProfileName)
  const [draft, setDraft] = useState('')
  return (
    <form
      className="mx-auto max-w-sm space-y-3 rounded-xl bg-panel p-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.trim()) setName(draft.trim())
      }}
    >
      <h1 className="text-xl font-semibold">Join room {roomId}</h1>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Your name
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={24} className={inputClass} placeholder="How friends will see you" />
      </label>
      <Button type="submit" variant="primary" disabled={!draft.trim()}>
        Join
      </Button>
    </form>
  )
}

export function RoomPage({ roomId, onOpenSettings }: { roomId: string; onOpenSettings: () => void }) {
  const hasName = useStore((s) => Boolean(s.profile.name.trim()))
  return hasName ? <Room roomId={roomId} onOpenSettings={onOpenSettings} /> : <NamePrompt roomId={roomId} />
}

type Tab = 'board' | 'showdown' | 'tournament'

function Room({ roomId, onOpenSettings }: { roomId: string; onOpenSettings: () => void }) {
  const view = useRoom((s) => s.view)
  const error = useRoom((s) => s.error)
  const [tab, setTab] = useState<Tab>('board')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void useRoom.getState().join(roomId)
    return () => useRoom.getState().leave()
  }, [roomId])

  // Jump to the showdown or tournament tab when the host starts one.
  const phase = view?.state.showdown.phase
  const [lastPhase, setLastPhase] = useState(phase)
  if (phase !== lastPhase) {
    setLastPhase(phase)
    if (phase === 'ranking') setTab('showdown')
  }
  const tournamentId = view?.state.tournament.bracket?.id
  const voting = currentMatchKey(view?.state.tournament.bracket ?? null) != null
  const [lastTournamentId, setLastTournamentId] = useState(tournamentId)
  if (tournamentId !== lastTournamentId) {
    setLastTournamentId(tournamentId)
    if (tournamentId) setTab('tournament')
  }

  const copyLink = async () => {
    const link = `${location.origin}${location.pathname}#/room/${roomId}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copy this link:', link)
    }
  }

  const online = view ? Object.keys(view.peers).length + 1 : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">
          Room <span className="font-mono text-lb-green">{roomId}</span>
        </h1>
        <Button onClick={() => void copyLink()}>{copied ? '✓ Link copied' : 'Copy invite link'}</Button>
        <span className="text-sm text-muted">
          {!view ? 'Connecting…' : online === 1 ? 'Waiting for friends to join…' : `${online} people online`}
          {view && !view.synced && ' · syncing…'}
        </span>
        <Button variant="ghost" className="ml-auto" onClick={() => navigate({ page: 'rooms' })}>
          Leave room
        </Button>
      </div>
      {error && <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300">Connection problem: {error}</p>}

      {view && (
        <>
          <MembersPanel />
          <div className="flex gap-1 border-b border-line" role="tablist">
            {(
              [
                ['board', 'Group board'],
                ['showdown', 'Showdown'],
                ['tournament', 'Tournament'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${tab === id ? 'border-lb-green text-text' : 'border-transparent text-muted hover:text-text'}`}
              >
                {label}
                {id === 'showdown' && phase && phase !== 'idle' && <span className="ml-1.5 rounded bg-lb-orange px-1 text-[10px] text-ink uppercase">{phase}</span>}
                {id === 'tournament' && voting && <span className="ml-1.5 rounded bg-lb-orange px-1 text-[10px] text-ink uppercase">live</span>}
              </button>
            ))}
          </div>
          {tab === 'board' && <GroupBoard onOpenSettings={onOpenSettings} />}
          {tab === 'showdown' && <Showdown />}
          {tab === 'tournament' && <RoomTournament />}
        </>
      )}
    </div>
  )
}
