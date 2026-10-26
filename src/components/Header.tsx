import { useRef } from 'react'
import { importFromFiles } from '../store/importFromFiles'
import { useStore } from '../store/useStore'
import { Button } from './ui'

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex gap-1" aria-hidden>
        <span className="size-3 rounded-full bg-lb-orange" />
        <span className="size-3 rounded-full bg-lb-green" />
        <span className="size-3 rounded-full bg-lb-blue" />
      </span>
      <span className="text-lg font-bold tracking-tight">
        letterboxd<span className="text-muted">2</span>tierlist
      </span>
    </div>
  )
}

export function Header({ onSettings, onExport }: { onSettings: () => void; onExport: () => void }) {
  const films = useStore((s) => s.films)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <div className="flex items-center gap-2">
          {films.length > 0 && (
            <>
              <span className="hidden text-sm text-muted sm:inline">{films.length} films</span>
              <Button variant="ghost" onClick={() => inputRef.current?.click()} title="Import a newer Letterboxd export">
                Re-import
              </Button>
              <Button variant="primary" onClick={onExport}>
                Export
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={onSettings} aria-label="Settings" title="Settings">
            ⚙ <span className="hidden sm:inline">Settings</span>
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.csv,.json"
            multiple
            hidden
            onChange={(e) => {
              void importFromFiles([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </header>
  )
}
