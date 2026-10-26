import { useState } from 'react'
import { Button, inputClass } from '../components/ui'
import { randomId } from '../lib/random'
import { navigate } from '../router'
import { useStore } from '../store/useStore'

/** Accepts a bare code or a full invite link. */
function parseRoomCode(text: string): string | null {
  const code = text.trim().match(/(?:#\/room\/)?([a-z0-9-]{4,32})\/?$/i)?.[1]
  return code ? code.toLowerCase() : null
}

export function RoomsLobby() {
  const name = useStore((s) => s.profile.name)
  const setName = useStore((s) => s.setProfileName)
  const recentRooms = useStore((s) => s.recentRooms)
  const [code, setCode] = useState('')
  const parsed = parseRoomCode(code)

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Rank films with your friends.</h1>
        <p className="text-muted">
          Create a room, send the link, and everyone adds their Letterboxd films. Build one shared tier list together, or run a showdown: everyone ranks the same
          films in secret, then the lists are revealed and voted on.
        </p>
      </div>

      <div className="rounded-xl bg-panel p-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="How friends will see you" maxLength={24} className={`${inputClass} max-w-xs`} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl bg-panel p-5">
          <h2 className="text-lg font-semibold">Create a room</h2>
          <p className="flex-1 text-sm text-muted">You get a link to share. The room stays alive as long as someone has it open.</p>
          <Button variant="primary" disabled={!name.trim()} onClick={() => navigate({ page: 'room', roomId: randomId(6) })}>
            Create room
          </Button>
        </div>
        <form
          className="flex flex-col gap-3 rounded-xl bg-panel p-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (parsed) navigate({ page: 'room', roomId: parsed })
          }}
        >
          <h2 className="text-lg font-semibold">Join a room</h2>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Room code or invite link" className={inputClass} />
          <Button type="submit" disabled={!name.trim() || !parsed}>
            Join
          </Button>
        </form>
      </div>
      {!name.trim() && <p className="text-center text-sm text-lb-orange">Enter your name first.</p>}

      {recentRooms.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Recent rooms</h2>
          <div className="flex flex-wrap gap-2">
            {recentRooms.map((id) => (
              <a key={id} href={`#/room/${id}`} className="rounded-md bg-panel px-3 py-1.5 font-mono text-sm hover:bg-raised">
                {id}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Rooms are peer-to-peer: browsers talk directly to each other (WebRTC), with public Nostr relays only used to find each other. Nothing is stored on a
        server; each person's browser keeps a copy of the room, so anyone can reopen it later. A few strict networks (some corporate or mobile ones) block
        direct connections.
      </p>
    </div>
  )
}
