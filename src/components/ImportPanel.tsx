import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { Trans } from '../i18n/Trans'
import { importFromFiles } from '../store/importFromFiles'
import { Button } from './ui'

export function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useT()
  const strong = (text: React.ReactNode) => <span className="text-text">{text}</span>

  const handle = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    await importFromFiles(files)
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('import.heading')}</h1>
        <p className="text-muted">{t('import.intro')}</p>
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
          <p className="text-lg font-semibold">{busy ? t('import.reading') : t('import.drop')}</p>
          <p className="text-sm text-muted">{t('import.alternatives')}</p>
        </div>
        <Button variant="primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {t('import.choose')}
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
          <span className="font-semibold text-text">1.</span>{' '}
          <Trans
            k="import.step1"
            tags={{
              link: (text) => (
                <a className="text-lb-blue hover:underline" href="https://letterboxd.com/settings/data/" target="_blank" rel="noreferrer">
                  {text}
                </a>
              ),
              b: strong,
            }}
          />
        </li>
        <li>
          <span className="font-semibold text-text">2.</span> <Trans k="import.step2" tags={{ b: strong }} />
        </li>
        <li>
          <span className="font-semibold text-text">3.</span> {t('import.step3')}
        </li>
      </ol>
    </div>
  )
}
