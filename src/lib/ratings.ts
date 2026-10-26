export const RATING_VALUES = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5] as const

export function stars(rating: number | null): string {
  if (rating == null) return 'Unrated'
  return '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '')
}

export const ratingKey = (rating: number) => String(rating)

/** Stars for half-star values, a number otherwise (medians can be e.g. 4.25). */
export function ratingText(rating: number | null): string {
  if (rating == null) return 'unrated'
  return Number.isInteger(rating * 2) ? stars(rating) : `${rating.toFixed(2).replace(/0$/, '')}★`
}
