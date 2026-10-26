import { useState } from 'react'
import { validateKey } from '../lib/tmdb/client'
import { startEnrichment, stopEnrichment } from '../store/enrichment'
import { useStore } from '../store/useStore'
import { Button, Dialog, Section, inputClass } from './ui'

type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'error'; message: string }

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Settings">
      <SettingsContent onClose={onClose} />
    </Dialog>
  )
}

/** Mounted only while the dialog is open, so the form starts fresh each time. */
function SettingsContent({ onClose }: { onClose: () => void }) {
  const tmdbKey = useStore((s) => s.tmdbKey)
  const setTmdbKey = useStore((s) => s.setTmdbKey)
  const clearMatches = useStore((s) => s.clearMatches)
  const resetAll = useStore((s) => s.resetAll)
  const setEnrichment = useStore((s) => s.setEnrichment)
  const [draft, setDraft] = useState(tmdbKey)
  const [reveal, setReveal] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const save = async () => {
    const key = draft.trim()
    setStatus({ kind: 'checking' })
    try {
      await validateKey(key)
      setTmdbKey(key)
      setEnrichment({ error: null })
      setStatus({ kind: 'ok' })
      void startEnrichment()
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not reach TMDB' })
    }
  }

  return (
    <>
      <Section title="TMDB API key">
        <p className="text-sm text-muted">
          Posters come from The Movie Database. Create a free account, then copy the <span className="text-text">API Key</span> or the{' '}
          <span className="text-text">API Read Access Token</span> from{' '}
          <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-lb-blue hover:underline">
            themoviedb.org/settings/api
          </a>
          . It's stored only in this browser.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <input
            type={reveal ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your TMDB key"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} min-w-0 flex-1 font-mono`}
          />
          <Button variant="ghost" onClick={() => setReveal(!reveal)} aria-label={reveal ? 'Hide key' : 'Show key'}>
            {reveal ? 'Hide' : 'Show'}
          </Button>
          <Button type="submit" variant="primary" disabled={!draft.trim() || status.kind === 'checking'}>
            {status.kind === 'checking' ? 'Checking…' : 'Save'}
          </Button>
        </form>
        {status.kind === 'ok' && <p className="text-sm text-lb-green">Key works. Fetching posters…</p>}
        {status.kind === 'error' && <p className="text-sm text-red-400">{status.message}</p>}
      </Section>

      <Section title="Data">
        <p className="text-sm text-muted">Your library, board and poster matches are saved in this browser (IndexedDB).</p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              stopEnrichment()
              clearMatches()
              setTimeout(() => void startEnrichment(), 50)
              onClose()
            }}
          >
            Re-match all posters
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!confirm('Delete your imported films, tier board and poster matches from this browser?')) return
              stopEnrichment()
              resetAll()
              onClose()
            }}
          >
            Delete all data
          </Button>
        </div>
        <p className="text-xs text-muted">Re-matching keeps the posters you picked by hand.</p>
      </Section>
    </>
  )
}
