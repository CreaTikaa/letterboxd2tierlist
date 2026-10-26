import { useMemo } from 'react'
import { startEnrichment, stopEnrichment } from '../store/enrichment'
import { useStore } from '../store/useStore'
import { Button, ProgressBar } from './ui'

export function EnrichmentStatus({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { running, done, total, error } = useStore((s) => s.enrichment)
  const tmdbKey = useStore((s) => s.tmdbKey)
  const films = useStore((s) => s.films)
  const matches = useStore((s) => s.matches)
  const missing = useMemo(() => films.filter((f) => matches[f.id]?.status !== 'matched').length, [films, matches])

  if (!tmdbKey) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lb-orange/40 bg-lb-orange/10 px-4 py-3 text-sm">
        <span>Add a free TMDB API key to show posters. Until then films appear as title cards.</span>
        <Button variant="primary" onClick={onOpenSettings}>
          Add TMDB key
        </Button>
      </div>
    )
  }

  if (running) {
    return (
      <div className="space-y-2 rounded-lg bg-panel px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>
            Finding posters… <span className="text-muted">{done} / {total}</span>
          </span>
          <Button variant="ghost" onClick={stopEnrichment}>
            Stop
          </Button>
        </div>
        <ProgressBar value={done} max={total} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
        <span>{error}</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onOpenSettings}>
            Settings
          </Button>
          <Button onClick={() => void startEnrichment()}>Retry</Button>
        </div>
      </div>
    )
  }

  const unchecked = films.filter((f) => !matches[f.id]).length
  if (unchecked > 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-panel px-4 py-3 text-sm">
        <span>{unchecked} films still need a poster lookup.</span>
        <Button onClick={() => void startEnrichment()}>Resume</Button>
      </div>
    )
  }

  if (missing > 0) {
    return (
      <p className="text-xs text-muted">
        {missing} film{missing > 1 ? 's' : ''} without a poster (shown as title cards). Click any film to fix its match.
      </p>
    )
  }
  return null
}
