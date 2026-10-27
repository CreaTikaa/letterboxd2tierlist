import { titleKey } from './letterboxd/parse'
import type { SharedList } from './share'

export interface FilmComparison {
  name: string
  year: number | null
  poster: string | null
  /** Tier index in each list. */
  tierA: number
  tierB: number
  /** Relative position (0 = top tier, 1 = bottom tier), so lists with different tier counts compare fairly. */
  gap: number
}

export interface ListComparison {
  common: FilmComparison[]
  onlyA: number
  onlyB: number
  /** 0–100: how close the two lists place the films they share. */
  agreement: number
}

function placements(list: SharedList) {
  const result = new Map<string, { tier: number; position: number; name: string; year: number | null; poster: string | null }>()
  const last = Math.max(1, list.tiers.length - 1)
  list.tiers.forEach((tier, index) => {
    for (const film of tier.films) {
      const key = titleKey(film)
      if (!result.has(key)) result.set(key, { tier: index, position: index / last, name: film.name, year: film.year, poster: film.poster })
    }
  })
  return result
}

export function compareLists(a: SharedList, b: SharedList): ListComparison {
  const inA = placements(a)
  const inB = placements(b)
  const common: FilmComparison[] = []
  for (const [key, placeA] of inA) {
    const placeB = inB.get(key)
    if (!placeB) continue
    common.push({
      name: placeA.name,
      year: placeA.year,
      poster: placeA.poster ?? placeB.poster,
      tierA: placeA.tier,
      tierB: placeB.tier,
      gap: Math.abs(placeA.position - placeB.position),
    })
  }
  const meanGap = common.length ? common.reduce((sum, c) => sum + c.gap, 0) / common.length : 1
  return {
    common: common.sort((x, y) => y.gap - x.gap || x.name.localeCompare(y.name)),
    onlyA: inA.size - common.length,
    onlyB: inB.size - common.length,
    agreement: Math.round((1 - meanGap) * 100),
  }
}
