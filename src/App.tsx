import { useEffect, useState } from 'react'
import { ExportDialog } from './components/ExportDialog'
import { Header } from './components/Header'
import { MatchDialog } from './components/MatchDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { Toast } from './components/Toast'
import { useHydrated } from './hooks'
import { RoomPage } from './pages/RoomPage'
import { RoomsLobby } from './pages/RoomsLobby'
import { TierListPage } from './pages/TierListPage'
import { TournamentPage } from './pages/TournamentPage'
import { useRoute } from './router'
import { startEnrichment } from './store/enrichment'
import { useStore } from './store/useStore'

type DialogName = 'settings' | 'export' | null

export default function App() {
  const hydrated = useHydrated()
  const route = useRoute()
  const films = useStore((s) => s.films)
  const tmdbKey = useStore((s) => s.tmdbKey)
  const [dialog, setDialog] = useState<DialogName>(null)
  const close = () => setDialog(null)
  const openSettings = () => setDialog('settings')

  // Look up posters for new films whenever the library or the key changes.
  useEffect(() => {
    if (hydrated && tmdbKey && films.length) void startEnrichment()
  }, [hydrated, tmdbKey, films])

  if (!hydrated) return null

  return (
    <div className="flex min-h-screen flex-col">
      <Header onSettings={openSettings} onExport={() => setDialog('export')} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-4 px-4 py-4">
        {route.page === 'tierlist' && <TierListPage onOpenSettings={openSettings} />}
        {route.page === 'rooms' && <RoomsLobby />}
        {route.page === 'room' && <RoomPage key={route.roomId} roomId={route.roomId} onOpenSettings={openSettings} />}
        {route.page === 'tournament' && <TournamentPage />}
      </main>

      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        <p>
          Film data and posters from{' '}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-lb-blue hover:underline">
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB. Not affiliated with Letterboxd, TierMaker or UwUfufu.
        </p>
        <p className="mt-1">
          Your data stays in your browser ·{' '}
          <a href="https://github.com/CreaTikaa/letterboxd2tierlist" target="_blank" rel="noreferrer" className="hover:text-text">
            Source on GitHub
          </a>
        </p>
      </footer>

      <SettingsDialog open={dialog === 'settings'} onClose={close} />
      <ExportDialog open={dialog === 'export'} onClose={close} />
      <MatchDialog />
      <Toast />
    </div>
  )
}
