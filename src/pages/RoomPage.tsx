import { useEffect, useState } from 'react'
import { GroupBoard } from '../components/room/GroupBoard'
import { MembersPanel } from '../components/room/MembersPanel'
import { RoomTournament } from '../components/room/RoomTournament'
import { Showdown } from '../components/room/Showdown'
import { Button, inputClass } from '../components/ui'
import { useT, type TKey } from '../i18n'
import { Trans } from '../i18n/Trans'
import { currentMatchKey } from '../lib/room/groupTournament'
import { navigate, routeHref } from '../router'
import { useRoom } from '../store/useRoom'
import { useStore } from '../store/useStore'

function NamePrompt({ roomId }: { roomId: string }) {
  const setName = useStore((s) => s.setProfileName)
  const [draft, setDraft] = useState('')
  const t = useT()
  return (
    <form
      className="mx-auto max-w-sm space-y-3 rounded-xl bg-panel p-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.trim()) setName(draft.trim())
      }}
    >
      <h1 className="text-xl font-semibold">{t('room.joinTitle', { room: roomId })}</h1>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        {t('lobby.yourName')}
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={24} className={inputClass} placeholder={t('lobby.namePlaceholder')} />
      </label>
      <Button type="submit" variant="primary" disabled={!draft.trim()}>
        {t('lobby.join')}
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
  const t = useT()
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
      <input type="password" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('room.passwordPlaceholder')} autoComplete="off" className={`${inputClass} w-48`} />
      <Button type="submit" variant="primary">
        {draft.trim() ? t('room.usePassword') : t('room.noPassword')}
      </Button>
      <Button variant="ghost" onClick={onDone}>
        {t('common.cancel')}
      </Button>
    </form>
  )
}

type Tab = 'board' | 'showdown' | 'tournament'

const TABS: [Tab, TKey][] = [
  ['board', 'room.tabBoard'],
  ['showdown', 'room.tabShowdown'],
  ['tournament', 'room.tabTournament'],
]

function Room({ roomId, onOpenSettings }: { roomId: string; onOpenSettings: () => void }) {
  const view = useRoom((s) => s.view)
  const error = useRoom((s) => s.error)
  const passwordRejected = useRoom((s) => s.passwordRejected)
  const password = useStore((s) => s.roomPasswords[roomId] ?? '')
  const [tab, setTab] = useState<Tab>('board')
  const [copied, setCopied] = useState<'plain' | 'password' | null>(null)
  const [editingPassword, setEditingPassword] = useState(false)
  const [lonely, setLonely] = useState(false)
  const t = useT()

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
      prompt(t('share.prompt'), link)
    }
  }

  const online = view ? Object.keys(view.peers).length + 1 : 1
  const connected = view != null

  // Alone for a while? A password mismatch looks exactly like an empty room from this side (the
  // "wrong password" signal can reach only the other person), so suggest it.
  useEffect(() => {
    if (!connected || online > 1) return
    const timer = setTimeout(() => setLonely(true), 10_000)
    return () => clearTimeout(timer)
  }, [connected, online])
  const showLonelyHint = lonely && online === 1 && !passwordRejected && !editingPassword

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">
          <Trans k="room.title" params={{ room: roomId }} tags={{ code: (text) => <span className="font-mono text-lb-green">{text}</span> }} />
        </h1>
        <Button onClick={() => void copyLink(false)}>{copied === 'plain' ? t('room.linkCopied') : t('room.copyInvite')}</Button>
        {password && (
          <Button variant="ghost" onClick={() => void copyLink(true)} title={t('room.copyWithPasswordTitle')}>
            {copied === 'password' ? t('room.copied') : t('room.copyWithPassword')}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setEditingPassword(!editingPassword)} title={t('room.passwordTitle')}>
          {password ? t('room.password') : t('room.addPassword')}
        </Button>
        <span className="text-sm text-muted">
          {!view ? t('room.connecting') : online === 1 ? t('room.waiting') : t('room.online', { count: online })}
          {view && !view.synced && t('room.syncing')}
        </span>
        <Button variant="ghost" className="ml-auto" onClick={() => navigate({ page: 'rooms' })}>
          {t('room.leave')}
        </Button>
      </div>
      {error && <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300">{t('room.connectionProblem', { message: error })}</p>}
      {showLonelyHint && (
        <p className="rounded-lg bg-panel px-4 py-2 text-sm text-muted">
          {password ? (
            t('room.aloneWithPassword')
          ) : (
            <Trans
              k="room.aloneNoPassword"
              tags={{
                link: (text) => (
                  <button type="button" onClick={() => setEditingPassword(true)} className="text-lb-blue hover:underline">
                    {text}
                  </button>
                ),
              }}
            />
          )}
        </p>
      )}
      {passwordRejected && !editingPassword && (
        <PasswordForm
          roomId={roomId}
          current={password}
          onDone={() => setEditingPassword(false)}
          prompt={password ? t('room.passwordWrong') : t('room.passwordNeeded')}
        />
      )}
      {editingPassword && (
        <PasswordForm
          roomId={roomId}
          current={password}
          onDone={() => setEditingPassword(false)}
          prompt={t('room.passwordChange')}
        />
      )}

      {view && (
        <>
          <MembersPanel />
          <div className="flex gap-1 border-b border-line" role="tablist">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${tab === id ? 'border-lb-green text-text' : 'border-transparent text-muted hover:text-text'}`}
              >
                {t(label)}
                {id === 'showdown' && phase && phase !== 'idle' && (
                  <span className="ml-1.5 rounded bg-lb-orange px-1 text-[10px] text-ink uppercase">{t(`room.phase.${phase}`)}</span>
                )}
                {id === 'tournament' && voting && <span className="ml-1.5 rounded bg-lb-orange px-1 text-[10px] text-ink uppercase">{t('room.live')}</span>}
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
