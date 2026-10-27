import { useRef } from 'react'
import { LANGUAGES, loadLanguage, useT, type Language, type TKey } from '../i18n'
import { routeHref, useRoute, type Route } from '../router'
import { importFromFiles } from '../store/importFromFiles'
import { useStore } from '../store/useStore'
import { Button } from './ui'

export function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2.5">
      <span className="flex gap-1" aria-hidden>
        <span className="size-3 rounded-full bg-lb-orange" />
        <span className="size-3 rounded-full bg-lb-green" />
        <span className="size-3 rounded-full bg-lb-blue" />
      </span>
      <span className="text-lg font-bold tracking-tight">
        letterboxd<span className="text-muted">2</span>tierlist
      </span>
    </a>
  )
}

const NAV: { label: TKey; route: Route; pages: Route['page'][] }[] = [
  { label: 'nav.tierList', route: { page: 'tierlist' }, pages: ['tierlist'] },
  { label: 'nav.rooms', route: { page: 'rooms' }, pages: ['rooms', 'room'] },
  { label: 'nav.tournament', route: { page: 'tournament' }, pages: ['tournament'] },
  { label: 'nav.rank', route: { page: 'rank' }, pages: ['rank'] },
]

export function LanguageSelect({ className = '' }: { className?: string }) {
  const t = useT()
  const language = useStore((s) => s.language)
  const setLanguage = useStore((s) => s.setLanguage)
  return (
    <select
      value={language}
      // Switch once the dictionary is downloaded, so the page never shows a mix of languages.
      onChange={(e) => {
        const next = e.target.value as Language
        void loadLanguage(next).then(() => setLanguage(next))
      }}
      aria-label={t('header.language')}
      title={t('header.language')}
      className={`rounded-md border border-line bg-ink px-2 py-1 text-sm text-muted hover:text-text focus:border-lb-blue focus:outline-none ${className}`}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  )
}

export function Header({ onSettings, onExport }: { onSettings: () => void; onExport: () => void }) {
  const films = useStore((s) => s.films)
  const route = useRoute()
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Logo />
        <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
          {NAV.map((item) => {
            const active = item.pages.includes(route.page)
            return (
              <a
                key={item.label}
                href={routeHref(item.route)}
                aria-current={active ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition ${active ? 'bg-raised text-text' : 'text-muted hover:text-text'}`}
              >
                {t(item.label)}
              </a>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {route.page === 'tierlist' && films.length > 0 && (
            <>
              <span className="hidden text-sm text-muted lg:inline">{t('common.films', { count: films.length })}</span>
              <Button variant="ghost" onClick={() => inputRef.current?.click()} title={t('header.reimportTitle')}>
                {t('header.reimport')}
              </Button>
              <Button variant="primary" onClick={onExport}>
                {t('header.export')}
              </Button>
            </>
          )}
          <LanguageSelect />
          <Button variant="ghost" onClick={onSettings} aria-label={t('common.settings')} title={t('common.settings')}>
            ⚙ <span className="hidden sm:inline">{t('common.settings')}</span>
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
