import { useEffect, useState } from 'react'
import { AutoFillDialog } from './components/AutoFillDialog'
import { Board } from './components/board/Board'
import { EnrichmentStatus } from './components/EnrichmentStatus'
import { ExportDialog } from './components/ExportDialog'
import { FilterBar } from './components/FilterBar'
import { Header } from './components/Header'
import { ImportPanel } from './components/ImportPanel'
import { MatchDialog } from './components/MatchDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { Toast } from './components/Toast'
import { useHydrated } from './hooks'
import { startEnrichment } from './store/enrichment'
import { useStore } from './store/useStore'

type DialogName = 'settings' | 'export' | 'autofill' | null

export default function App() {
  const hydrated = useHydrated()
  const films = useStore((s) => s.films)
  const tmdbKey = useStore((s) => s.tmdbKey)
  const [dialog, setDialog] = useState<DialogName>(null)
  const close = () => setDialog(null)

  // Look up posters for new films whenever the library or the key changes.
  useEffect(() => {
    if (hydrated && tmdbKey && films.length) void startEnrichment()
  }, [hydrated, tmdbKey, films])

  if (!hydrated) return null

  return (
    <div className="flex min-h-screen flex-col">
      <Header onSettings={() => setDialog('settings')} onExport={() => setDialog('export')} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-4 px-4 py-4">
        {films.length === 0 ? (
          <ImportPanel />
        ) : (
          <>
            <EnrichmentStatus onOpenSettings={() => setDialog('settings')} />
            <FilterBar />
            <Board onAutoFill={() => setDialog('autofill')} />
          </>
        )}
      </main>

      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        <p>
          Film data and posters from{' '}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-lb-blue hover:underline">
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB. Not affiliated with Letterboxd or TierMaker.
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
      <AutoFillDialog open={dialog === 'autofill'} onClose={close} />
      <MatchDialog />
      <Toast />
    </div>
  )
}
