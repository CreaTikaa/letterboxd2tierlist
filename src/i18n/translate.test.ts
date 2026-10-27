import { describe, expect, it } from 'vitest'
import { ordinal, translate } from '.'

describe('translate', () => {
  it('fills placeholders and picks plural forms per language', () => {
    expect(translate('en', 'common.films', { count: 1 })).toBe('1 film')
    expect(translate('en', 'common.films', { count: 2 })).toBe('2 films')
    // French treats 0 and 1 as singular.
    expect(translate('fr', 'common.films', { count: 0 })).toBe('0 film')
    expect(translate('fr', 'common.films', { count: 5 })).toBe('5 films')
    expect(translate('zh', 'common.films', { count: 5 })).toBe('5 部电影')
    expect(translate('pt', 'common.films', { count: 1 })).toBe('1 filme')
    expect(translate('pt', 'room.online', { count: 3 })).toBe('3 pessoas online')
  })

  it('keeps unknown placeholders visible instead of dropping them', () => {
    expect(translate('en', 'errors.tmdbFailed')).toBe('TMDB request failed ({status}).')
  })

  it('formats ordinals', () => {
    expect([1, 2, 3, 4, 11, 21].map((n) => ordinal('en', n))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '21st'])
    expect([1, 3].map((n) => ordinal('fr', n))).toEqual(['1er', '3e'])
    expect(ordinal('pt', 5)).toBe('5º')
    expect(ordinal('zh', 5)).toBe('第5名')
  })
})

describe('number formatting', () => {
  it('formats medians and averages for the language', async () => {
    const { averageText, ratingText } = await import('../lib/ratings')
    expect(ratingText(4.25, 'fr')).toBe('4,25★')
    expect(ratingText(4.25, 'en')).toBe('4.25★')
    expect(ratingText(4.5, 'fr')).toBe('★★★★½')
    expect(averageText(3.666, 'pt-BR')).toBe('3,7★')
    expect(averageText(4, 'zh-CN', 2)).toBe('4.00★')
  })
})
