export const RATING_VALUES = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5] as const

/** "★★★½"; empty for unrated films (callers show their own label). */
export function stars(rating: number | null): string {
  if (rating == null) return ''
  return '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '')
}

export const ratingKey = (rating: number) => String(rating)

/** Stars for half-star values, a number otherwise (medians can be e.g. 4.25, or "4,25" in French). */
export function ratingText(rating: number | null, locale = 'en'): string {
  if (rating == null) return ''
  return Number.isInteger(rating * 2) ? stars(rating) : `${rating.toLocaleString(locale, { maximumFractionDigits: 2 })}★`
}

/** An average like "3.7★" (or "3,7★"), with a fixed number of decimals. */
export function averageText(value: number, locale = 'en', decimals = 1): string {
  return `${value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}★`
}
