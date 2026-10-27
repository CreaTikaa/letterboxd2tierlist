export type Language = 'en' | 'fr' | 'zh' | 'pt'

export const LANGUAGES: { code: Language; name: string; locale: string }[] = [
  { code: 'en', name: 'English', locale: 'en' },
  { code: 'fr', name: 'Français', locale: 'fr' },
  { code: 'zh', name: '简体中文', locale: 'zh-CN' },
  { code: 'pt', name: 'Português (Brasil)', locale: 'pt-BR' },
]

export const localeOf = (language: Language) => LANGUAGES.find((l) => l.code === language)?.locale ?? 'en'

/** Best match for the browser's preferred languages, English otherwise. */
export function detectLanguage(preferred: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if (LANGUAGES.some((l) => l.code === base)) return base as Language
  }
  return 'en'
}
