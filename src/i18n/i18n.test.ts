import { describe, expect, it } from 'vitest'
import { en } from './en'
import { fr } from './fr'
import { detectLanguage } from './languages'
import { pt } from './pt'
import { zh } from './zh'

const TRANSLATIONS = { fr, zh, pt } as const

const placeholders = (text: string) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort()

/** Keys where a language may use different (but provided) parameters than English. */
const ALTERNATIVE_PARAMS: Record<string, string[]> = {
  'place.range': ['from', 'to', 'fromN', 'toN'],
  'round.of': ['n', 'half'],
}

describe('translations', () => {
  for (const [language, messages] of Object.entries(TRANSLATIONS)) {
    describe(language, () => {
      it('has exactly the English keys', () => {
        expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort())
      })

      it('has no empty messages', () => {
        const empty = Object.entries(messages).filter(([, text]) => !text.trim())
        expect(empty).toEqual([])
      })

      it('uses the same placeholders and markup as English', () => {
        const problems: string[] = []
        for (const [key, english] of Object.entries(en) as [keyof typeof en, string][]) {
          const text = messages[key]
          const allowed = new Set([...placeholders(english), ...(ALTERNATIVE_PARAMS[key] ?? [])])
          const used = placeholders(text)
          for (const name of used) if (!allowed.has(name)) problems.push(`${key}: unknown {${name}}`)
          // Every English placeholder must appear, except where alternatives exist or a singular
          // form spells out "one" instead of the number.
          if (!ALTERNATIVE_PARAMS[key]) {
            for (const name of placeholders(english)) {
              if (!used.has(name) && !(key.endsWith('_one') && name === 'count')) problems.push(`${key}: missing {${name}}`)
            }
          }
          if (tags(text).join() !== tags(english).join()) problems.push(`${key}: markup ${tags(text)} vs ${tags(english)}`)
        }
        expect(problems).toEqual([])
      })
    })
  }
})

describe('detectLanguage', () => {
  it('picks the first supported browser language', () => {
    expect(detectLanguage(['de-DE', 'pt-BR', 'en'])).toBe('pt')
    expect(detectLanguage(['zh-TW'])).toBe('zh')
    expect(detectLanguage(['fr-CA', 'en-US'])).toBe('fr')
    expect(detectLanguage(['ja-JP'])).toBe('en')
    expect(detectLanguage([])).toBe('en')
  })
})
