import { useEffect, useState } from 'react'
import { GroupBoard } from '../components/room/GroupBoard'
import { MembersPanel } from '../components/room/MembersPanel'
import { RoomTournament } from '../components/room/RoomTournament'
import { Showdown } from '../components/room/Showdown'
import { Button, inputClass } from '../components/ui'
import { currentMatchKey } from '../lib/room/groupTournament'
import { navigate, routeHref } from '../router'
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

export function RoomPage({ roomId, linkPassword, onOpenSettings }: { roomId: string; linkPassword?: string; onOpenSettings: () => void }) {
  const hasName = useStore((s) => Boolean(s.profile.name.trim()))

  // Invite links can carry the password: remember it, then drop it from the address bar
  // (the hashchange makes the route re-read without it, which renders the room).
  useEffect(() => {
    if (!linkPassword) return
    useStore.getState().setRoomPassword(roomId, linkPassword)
    history.replaceState(null, '', `#/room/${roomId}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }, [roomId, linkPassword])

  if (linkPassword) return null
  return hasName ? <Room roomId={roomId} onOpenSettings={onOpenSettings} /> : <NamePrompt roomId={roomId} />
}

/** Set, change or remove the password for this room (everyone needs the same one). */
function PasswordForm({ roomId, current, onDone, prompt }: { roomId: string; current: string; onDone: () => void; prompt: string }) {
  const setRoomPassword = useStore((s) => s.setRoomPassword)
  const [draft, setDraft] = useState(current)
  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-lg bg-panel px-4 py-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        setRoomPassword(roomId, draft.trim())
        onDone()
      }}
    >
      <span className="text-muted">{prompt}</span>
      <input type="password" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Room password" autoComplete="off" className={`${inputClass} w-48`} />
      <Button type="submit" variant="primary">
        {draft.trim() ? 'Use password' : 'No password'}
      </Button>
      <Button variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </form>
  )
}

type Tab = 'board' | 'showdown' | 'tournament'

function Room({ roomId, onOpenSettings }: { roomId: string; onOpenSettings: () => void }) {
  const view = useRoom((s) => s.view)
  const error = useRoom((s) => s.error)
  const passwordRejected = useRoom((s) => s.passwordRejected)
  const password = useStore((s) => s.roomPasswords[roomId] ?? '')
  const [tab, setTab] = useState<Tab>('board')
  const [copied, setCopied] = useState<'plain' | 'password' | null>(null)
  const [editingPassword, setEditingPassword] = useState(false)

  useEffect(() => {
    void useRoom.getState().join(roomId, password)
  }, [roomId, password])
  useEffect(() => () => useRoom.getState().leave(), [roomId])

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

  const copyLink = async (withPassword: boolean) => {
    const link = `${location.origin}${location.pathname}${routeHref({ page: 'room', roomId, ...(withPassword && { password }) })}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(withPassword ? 'password' : 'plain')
      setTimeout(() => setCopied(null), 2000)
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
        <Button onClick={() => void copyLink(false)}>{copied === 'plain' ? '✓ Link copied' : 'Copy invite link'}</Button>
        {password && (
          <Button variant="ghost" onClick={() => void copyLink(true)} title="The link includes the password; only send it to people you trust">
            {copied === 'password' ? '✓ Copied' : 'Copy link + password'}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setEditingPassword(!editingPassword)} title="Everyone in the room must use the same password">
          {password ? '🔒 Password' : '🔓 Add password'}
        </Button>
        <span className="text-sm text-muted">
          {!view ? 'Connecting…' : online === 1 ? 'Waiting for friends to join…' : `${online} people online`}
          {view && !view.synced && ' · syncing…'}
        </span>
        <Button variant="ghost" className="ml-auto" onClick={() => navigate({ page: 'rooms' })}>
          Leave room
        </Button>
      </div>
      {error && <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300">Connection problem: {error}</p>}
      {passwordRejected && !editingPassword && (
        <PasswordForm
          roomId={roomId}
          current={password}
          onDone={() => setEditingPassword(false)}
          prompt={password ? 'Someone here uses a different password. Check it with your friends:' : 'This room has a password. Enter it to join:'}
        />
      )}
      {editingPassword && (
        <PasswordForm
          roomId={roomId}
          current={password}
          onDone={() => setEditingPassword(false)}
          prompt="Everyone must use the same password; changing it reconnects you."
        />
      )}

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
