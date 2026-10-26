import { describe, expect, it } from 'vitest'
import { defaultTiers } from '../tiers'
import type { Film } from '../types'
import { layoutColumns } from './png'
import { createSaveFile, parseSaveFile } from './saveFile'
import { planBatches, safeFileName, uniqueNames } from './tiermaker'

describe('safeFileName', () => {
  it('strips characters Windows and TierMaker reject', () => {
    expect(safeFileName('Mission: Impossible / Fallout? (2018)')).toBe('Mission Impossible Fallout (2018)')
    expect(safeFileName('Trailing dots...')).toBe('Trailing dots')
    expect(safeFileName('???')).toBe('film')
  })
})

describe('uniqueNames', () => {
  it('numbers repeated names case-insensitively', () => {
    expect(uniqueNames(['Heat (1995)', 'heat (1995)', 'Heat (1995)', 'Up'])).toEqual(['Heat (1995)', 'heat (1995) (2)', 'Heat (1995) (3)', 'Up'])
  })
})

describe('planBatches', () => {
  it('splits by file count', () => {
    expect(planBatches([1, 1, 1, 1, 1], 2, 100)).toEqual([[0, 1], [2, 3], [4]])
  })

  it('splits by total size', () => {
    expect(planBatches([40, 40, 40], 10, 100)).toEqual([[0, 1], [2]])
  })

  it('still places a single file that is bigger than the limit', () => {
    expect(planBatches([500, 10], 10, 100)).toEqual([[0], [1]])
  })

  it('handles no files', () => {
    expect(planBatches([])).toEqual([])
  })
})

describe('layoutColumns', () => {
  const films = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }) as Film)

  it('keeps the requested columns when the image fits', () => {
    expect(layoutColumns([{ tier: defaultTiers()[0], films: films(30) }], 10, true)).toBe(10)
  })

  it('adds columns when the image would be too tall for a canvas', () => {
    expect(layoutColumns([{ tier: defaultTiers()[0], films: films(2000) }], 10, true)).toBeGreaterThan(10)
  })
})

describe('save files', () => {
  it('round-trips through JSON', () => {
    const save = createSaveFile({ films: [], matches: {}, tiers: defaultTiers(), ratingMap: {}, filters: { ratings: [5], includeUnrated: false, search: '', yearMin: null, yearMax: null, genres: [] } })
    expect(parseSaveFile(JSON.stringify(save))).toEqual(save)
  })

  it('rejects other JSON files', () => {
    expect(() => parseSaveFile('{"hello":1}')).toThrow(/not a letterboxd2tierlist/)
    expect(() => parseSaveFile('nope')).toThrow(/not valid JSON/)
  })
})
