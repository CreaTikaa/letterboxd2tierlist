import { useCallback } from 'react'
import { AppError } from '../lib/errors'
import { TmdbError } from '../lib/tmdb/client'
import { useStore } from '../store/useStore'
import { en, type Messages } from './en'
import { fr } from './fr'
import { localeOf, type Language } from './languages'
import { pt } from './pt'
import { zh } from './zh'

export { LANGUAGES, detectLanguage, localeOf, type Language } from './languages'

const DICTIONARIES: Record<Language, Messages> = { en, fr, zh, pt }

type MessageKey = keyof Messages
/** Plural keys are written `key_one` / `key_other`…; callers use the bare `key` with a `count`. */
type PluralBase<K> = K extends `${infer Base}_${'zero' | 'one' | 'two' | 'few' | 'many' | 'other'}` ? Base : never
export type TKey = MessageKey | PluralBase<MessageKey>
export type Params = Record<string, string | number>
export type TFunction = (key: TKey, params?: Params) => string

const pluralRules = new Map<string, Intl.PluralRules>()
function pluralCategory(language: Language, count: number, type: Intl.PluralRuleType = 'cardinal') {
  const id = `${language}:${type}`
  if (!pluralRules.has(id)) pluralRules.set(id, new Intl.PluralRules(localeOf(language), { type }))
  return pluralRules.get(id)!.select(count)
}

function lookup(language: Language, key: string): string | undefined {
  return (DICTIONARIES[language] as Record<string, string>)[key] ?? (en as Record<string, string>)[key]
}

export function translate(language: Language, key: TKey, params?: Params): string {
  let template: string | undefined
  if (typeof params?.count === 'number') {
    template = lookup(language, `${key}_${pluralCategory(language, params.count)}`) ?? lookup(language, `${key}_other`)
  }
  template ??= lookup(language, key) ?? key
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (params?.[name] == null ? match : String(params[name])))
}

/** "1st", "1er", "1º", "第1名"… */
export function ordinal(language: Language, n: number): string {
  const category = pluralCategory(language, n, 'ordinal')
  return translate(language, `ordinal_${category}` as TKey, { n }) || translate(language, 'ordinal_other', { n })
}

/** Translation function for the current language; components re-render when it changes. */
export function useT(): TFunction {
  const language = useStore((s) => s.language)
  return useCallback((key: TKey, params?: Params) => translate(language, key, params), [language])
}

export function useLanguage(): Language {
  return useStore((s) => s.language)
}

/** BCP 47 locale of the current language, for number formatting. */
export function useLocale(): string {
  return localeOf(useStore((s) => s.language))
}

/** For code outside React (store actions, exports). */
export function t(key: TKey, params?: Params): string {
  return translate(useStore.getState().language, key, params)
}

export function currentLocale(): string {
  return localeOf(useStore.getState().language)
}

export function genreLabel(translateFn: TFunction, id: number): string {
  const key = `genre.${id}` as TKey
  const text = translateFn(key)
  return text === key ? translateFn('genre.unknown', { id }) : text
}

/** A message for any error, translated when we know what it is. */
export function errorMessage(translateFn: TFunction, error: unknown): string {
  if (error instanceof AppError) return translateFn(`errors.${error.code}` as TKey)
  if (error instanceof TmdbError) return error.status === 401 ? translateFn('errors.tmdbInvalidKey') : translateFn('errors.tmdbFailed', { status: error.status })
  if (error instanceof TypeError) return translateFn('errors.network')
  if (error instanceof Error && error.message) return error.message
  return translateFn('errors.unknown')
}
