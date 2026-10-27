import { useState } from 'react'
import { Button, inputClass } from '../components/ui'
import { useT } from '../i18n'
import { randomId } from '../lib/random'
import { navigate } from '../router'
import { markRoomCreated } from '../store/useRoom'
import { useStore } from '../store/useStore'

/** Accepts a bare code or a full invite link. */
function parseRoomCode(text: string): string | null {
  const code = text.trim().match(/(?:#\/room\/)?([a-z0-9-]{4,32})\/?(?:\?.*)?$/i)?.[1]
  return code ? code.toLowerCase() : null
}

export function RoomsLobby() {
  const name = useStore((s) => s.profile.name)
  const setName = useStore((s) => s.setProfileName)
  const recentRooms = useStore((s) => s.recentRooms)
  const roomPasswords = useStore((s) => s.roomPasswords)
  const setRoomPassword = useStore((s) => s.setRoomPassword)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const parsed = parseRoomCode(code)
  const t = useT()

  const open = (roomId: string, password: string) => {
    if (password) setRoomPassword(roomId, password)
    navigate({ page: 'room', roomId })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('lobby.heading')}</h1>
        <p className="text-muted">{t('lobby.intro')}</p>
      </div>

      <div className="rounded-xl bg-panel p-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">{t('lobby.yourName')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('lobby.namePlaceholder')} maxLength={24} className={`${inputClass} max-w-xs`} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl bg-panel p-5">
          <h2 className="text-lg font-semibold">{t('lobby.createTitle')}</h2>
          <p className="flex-1 text-sm text-muted">{t('lobby.createHelp')}</p>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('lobby.passwordOptional')}
            autoComplete="new-password"
            className={inputClass}
          />
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              const roomId = randomId(6)
              markRoomCreated(roomId)
              open(roomId, newPassword.trim())
            }}
          >
            {t('lobby.create')}
          </Button>
        </div>
        <form
          className="flex flex-col gap-3 rounded-xl bg-panel p-5"
          onSubmit={(e) => {
            e.preventDefault()
            // A pasted invite link may already carry the password.
            const linkPassword = code.match(/[?&]pw=([^&]+)/)?.[1]
            if (parsed) open(parsed, joinPassword.trim() || (linkPassword ? decodeURIComponent(linkPassword) : ''))
          }}
        >
          <h2 className="text-lg font-semibold">{t('lobby.joinTitle')}</h2>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('lobby.codePlaceholder')} className={inputClass} />
          <input
            type="password"
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value)}
            placeholder={t('lobby.passwordIfAny')}
            autoComplete="off"
            className={inputClass}
          />
          <Button type="submit" disabled={!name.trim() || !parsed}>
            {t('lobby.join')}
          </Button>
        </form>
      </div>
      {!name.trim() && <p className="text-center text-sm text-lb-orange">{t('lobby.nameFirst')}</p>}

      {recentRooms.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">{t('lobby.recent')}</h2>
          <div className="flex flex-wrap gap-2">
            {recentRooms.map((id) => (
              <a key={id} href={`#/room/${id}`} className="rounded-md bg-panel px-3 py-1.5 font-mono text-sm hover:bg-raised">
                {roomPasswords[id] && '🔒 '}
                {id}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">{t('lobby.p2pNote')}</p>
    </div>
  )
}
