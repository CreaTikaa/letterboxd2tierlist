import { useRef, useState } from 'react'
import { importFromFiles } from '../store/importFromFiles'
import { Button } from './ui'

export function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const handle = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    await importFromFiles(files)
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your Letterboxd diary, as a tier list.</h1>
        <p className="text-muted">
          Import every film you've logged, keep only the ratings you want, then rank them here or export a poster pack for TierMaker.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handle([...e.dataTransfer.files])
        }}
        className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? 'border-lb-green bg-lb-green/5' : 'border-line bg-panel'
        }`}
      >
        <div className="text-5xl" aria-hidden>
          🎞️
        </div>
        <div>
          <p className="text-lg font-semibold">{busy ? 'Reading your export…' : 'Drop your Letterboxd export ZIP here'}</p>
          <p className="text-sm text-muted">or watched.csv / ratings.csv, or a saved tier list (.json)</p>
        </div>
        <Button variant="primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.csv,.json"
          multiple
          hidden
          onChange={(e) => {
            void handle([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>

      <ol className="space-y-2 rounded-xl bg-panel p-5 text-sm text-muted">
        <li>
          <span className="font-semibold text-text">1.</span> On Letterboxd, go to{' '}
          <a className="text-lb-blue hover:underline" href="https://letterboxd.com/settings/data/" target="_blank" rel="noreferrer">
            Settings → Import &amp; Export
          </a>{' '}
          and click <span className="text-text">Export your data</span>.
        </li>
        <li>
          <span className="font-semibold text-text">2.</span> Drop the downloaded <code className="text-text">.zip</code> above. It's read entirely in your browser; nothing is uploaded.
        </li>
        <li>
          <span className="font-semibold text-text">3.</span> Add a free TMDB API key in Settings to get posters.
        </li>
      </ol>
    </div>
  )
}
