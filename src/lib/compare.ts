import { titleKey } from './letterboxd/parse'
import { tournamentFromShared, type SharedFilm, type SharedList, type SharedRanking, type SharedTournament } from './share'
import { TIER_COLORS } from './tiers'
import { standings } from './tournament'

export interface FilmComparison {
  name: string
  year: number | null
  poster: string | null
  /** Tier index in each list (for a ranking, its place minus one). */
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

const RANK_COLOR = '#d8e0e8'

/** A ranking as one film per tier, so its places compare exactly with another list. */
export function rankingAsList(ranking: SharedRanking): SharedList {
  return { title: ranking.title, tiers: ranking.films.map((film, i) => ({ label: `#${i + 1}`, color: RANK_COLOR, films: [film] })) }
}

/** A tournament as tiers by how far each film got: champion, runner-up, semi-finalists… */
export function tournamentAsList(shared: SharedTournament, placeLabel: (place: number) => string): SharedList {
  const { bracket } = tournamentFromShared(shared)
  const sharedFilm = new Map<string, SharedFilm>(bracket.seeds.map((film, i) => [film.id, shared.seeds[i]]))
  const table = standings(bracket)
  const places = [...new Set(table.map((s) => s.place))].sort((a, b) => a - b)
  return {
    title: shared.title,
    tiers: places.map((place, i) => ({
      label: placeLabel(place),
      color: TIER_COLORS[Math.min(i, TIER_COLORS.length - 1)],
      films: table.filter((s) => s.place === place).map((s) => sharedFilm.get(s.filmId)!),
    })),
  }
}
