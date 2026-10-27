import { describe, expect, it } from 'vitest'
import { compareLists } from './compare'
import type { SharedList } from './share'

const film = (name: string) => ({ name, year: 2000, poster: null })
const list = (...tiers: string[][]): SharedList => ({ title: '', tiers: tiers.map((names, i) => ({ label: String(i), color: '#fff', films: names.map(film) })) })

describe('compareLists', () => {
  it('scores identical lists 100 and opposite ones 0', () => {
    expect(compareLists(list(['A'], ['B']), list(['A'], ['B'])).agreement).toBe(100)
    expect(compareLists(list(['A'], ['B']), list(['B'], ['A'])).agreement).toBe(0)
  })

  it('compares relative positions when tier counts differ, biggest gaps first', () => {
    const result = compareLists(list(['A', 'B'], [], ['C']), list(['A'], ['C', 'X'], ['B'], ['Y'], ['Z']))
    // Positions: A 0/2→0, B 0/2→0, C 2/2→1 in the first list; A 0, C 1/4, B 2/4 in the second.
    expect(result.common.map((c) => c.name)).toEqual(['C', 'B', 'A'])
    expect(result.common[0]).toMatchObject({ tierA: 2, tierB: 1, gap: 0.75 })
    expect(result.onlyA).toBe(0)
    expect(result.onlyB).toBe(3)
  })

  it('handles lists with nothing in common', () => {
    expect(compareLists(list(['A']), list(['B']))).toMatchObject({ common: [], agreement: 0 })
  })
})
