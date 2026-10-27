import { useState } from 'react'
import { errorMessage, useT } from '../i18n'
import { Trans } from '../i18n/Trans'
import { validateKey } from '../lib/tmdb/client'
import { startEnrichment, stopEnrichment } from '../store/enrichment'
import { useStore } from '../store/useStore'
import { LanguageSelect } from './Header'
import { Button, Dialog, Section, inputClass } from './ui'

type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'error'; message: string }

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  return (
    <Dialog open={open} onClose={onClose} title={t('common.settings')}>
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
  const t = useT()

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
      setStatus({ kind: 'error', message: errorMessage(t, error) })
    }
  }

  return (
    <>
      <Section title={t('settings.languageTitle')}>
        <LanguageSelect className="w-full max-w-xs" />
      </Section>

      <Section title={t('settings.tmdbTitle')}>
        <p className="text-sm text-muted">
          <Trans
            k="settings.tmdbHelp"
            tags={{
              b: (text) => <span className="text-text">{text}</span>,
              link: (text) => (
                <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-lb-blue hover:underline">
                  {text}
                </a>
              ),
            }}
          />
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
            placeholder={t('settings.keyPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} min-w-0 flex-1 font-mono`}
          />
          <Button variant="ghost" onClick={() => setReveal(!reveal)} aria-label={reveal ? t('settings.hideKey') : t('settings.showKey')}>
            {reveal ? t('settings.hide') : t('settings.show')}
          </Button>
          <Button type="submit" variant="primary" disabled={!draft.trim() || status.kind === 'checking'}>
            {status.kind === 'checking' ? t('settings.checking') : t('settings.save')}
          </Button>
        </form>
        {status.kind === 'ok' && <p className="text-sm text-lb-green">{t('settings.keyWorks')}</p>}
        {status.kind === 'error' && <p className="text-sm text-red-400">{status.message}</p>}
      </Section>

      <Section title={t('settings.dataTitle')}>
        <p className="text-sm text-muted">{t('settings.dataHelp')}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              stopEnrichment()
              clearMatches()
              setTimeout(() => void startEnrichment(), 50)
              onClose()
            }}
          >
            {t('settings.rematch')}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!confirm(t('settings.deleteConfirm'))) return
              stopEnrichment()
              resetAll()
              onClose()
            }}
          >
            {t('settings.deleteAll')}
          </Button>
        </div>
        <p className="text-xs text-muted">{t('settings.rematchHelp')}</p>
      </Section>
    </>
  )
}
