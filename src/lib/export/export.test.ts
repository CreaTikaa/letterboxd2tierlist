import { describe, expect, it } from 'vitest'
import { defaultTiers } from '../tiers'
import type { Film } from '../types'
import { bracketLayout } from './bracketPng'
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

describe('bracketLayout', () => {
  it('splits each round between two sides that meet at the final', () => {
    const { boxes, width, centerY } = bracketLayout(16)
    // 8 + 4 + 2 matches on the sides, then the final.
    expect(boxes).toHaveLength(15)
    expect(boxes.filter((b) => b.side === 'left').map((b) => `${b.round}-${b.match}`)).toEqual(['0-0', '0-1', '0-2', '0-3', '1-0', '1-1', '2-0'])
    expect(boxes.filter((b) => b.side === 'right').map((b) => `${b.round}-${b.match}`)).toEqual(['0-4', '0-5', '0-6', '0-7', '1-2', '1-3', '2-1'])
    const final = boxes.at(-1)!
    expect(final).toMatchObject({ side: 'final', round: 3, match: 0, y: centerY })
    // Mirrored around the middle; each later match sits between the two that feed it.
    const [l, r] = [boxes.find((b) => b.side === 'left' && b.round === 2)!, boxes.find((b) => b.side === 'right' && b.round === 2)!]
    expect(l.x + l.width / 2 + r.x + r.width / 2).toBeCloseTo(width)
    expect(l.y).toBeCloseTo(centerY)
    const feeders = boxes.filter((b) => b.side === 'left' && b.round === 0).slice(0, 2)
    expect(boxes.find((b) => b.side === 'left' && b.round === 1)!.y).toBeCloseTo((feeders[0].y + feeders[1].y) / 2)
  })

  it('handles a two-film bracket and stays a sensible size for 256', () => {
    expect(bracketLayout(2).boxes).toHaveLength(1)
    const big = bracketLayout(256)
    expect(big.boxes).toHaveLength(255)
    expect(big.width * big.height).toBeLessThan(40_000_000)
  })
})
