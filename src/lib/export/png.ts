import { runPool } from '../pool'
import { posterUrl } from '../tmdb/client'
import type { Film, Match, Tier } from '../types'
import { FONT, canvasToBlob, createCanvas, drawCover, drawPlaceholder, loadBitmap, textColorFor, wrapText } from './canvas'

export interface TierRowData {
  tier: Tier
  films: Film[]
}

export interface PngOptions {
  columns: number
  title: string
  /** Credit line in the bottom corner. */
  footer: string
}

const CARD_W = 120
const CARD_H = 180
const LABEL_W = 150
const HEADER_H = 72
const FOOTER_H = 32
// Browsers refuse to draw on canvases much taller than this.
const MAX_HEIGHT = 16000

export function layoutColumns(rows: TierRowData[], requested: number, hasHeader: boolean): number {
  let columns = Math.max(1, requested)
  const height = (cols: number) =>
    rows.reduce((sum, row) => sum + Math.max(1, Math.ceil(row.films.length / cols)) * CARD_H, 0) + (hasHeader ? HEADER_H : 0) + FOOTER_H
  while (height(columns) > MAX_HEIGHT && columns < 60) columns++
  return columns
}

export async function renderTierListPng(
  rows: TierRowData[],
  matches: Record<string, Match>,
  options: PngOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const films = rows.flatMap((row) => row.films)
  const images = new Map<string, ImageBitmap>()
  let done = 0
  await runPool(films, 12, async (film) => {
    const match = matches[film.id]
    if (match?.status === 'matched' && match.posterPath) {
      try {
        images.set(film.id, await loadBitmap(posterUrl(match.posterPath, 'w185')))
      } catch {
        // Fall back to the title card for this film.
      }
    }
    onProgress?.(++done, films.length)
  })

  const header = options.title.trim()
  const columns = layoutColumns(rows, options.columns, Boolean(header))
  const rowHeights = rows.map((row) => Math.max(1, Math.ceil(row.films.length / columns)) * CARD_H)
  const width = LABEL_W + columns * CARD_W
  const height = (header ? HEADER_H : 0) + rowHeights.reduce((a, b) => a + b, 0) + FOOTER_H
  const { canvas, ctx } = createCanvas(width, height)

  ctx.fillStyle = '#1a1a17'
  ctx.fillRect(0, 0, width, height)

  let y = 0
  if (header) {
    ctx.fillStyle = '#fff'
    ctx.font = `700 34px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(header, width / 2, HEADER_H / 2)
    y = HEADER_H
  }

  rows.forEach((row, r) => {
    const rowH = rowHeights[r]
    ctx.fillStyle = row.tier.color
    ctx.fillRect(0, y, LABEL_W, rowH)
    ctx.fillStyle = textColorFor(row.tier.color)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Largest font size at which the label fits the label cell.
    let labelSize = 40
    let lines: string[] = []
    for (; labelSize >= 14; labelSize -= 2) {
      ctx.font = `600 ${labelSize}px ${FONT}`
      lines = wrapText(ctx, row.tier.label, LABEL_W - 16, 4)
      const fitsWidth = lines.every((line) => ctx.measureText(line).width <= LABEL_W - 16)
      if (fitsWidth && lines.length * labelSize * 1.2 <= rowH - 8) break
    }
    const lineH = Math.max(labelSize, 14) * 1.2
    lines.forEach((line, i) => ctx.fillText(line, LABEL_W / 2, y + rowH / 2 + (i - (lines.length - 1) / 2) * lineH))

    row.films.forEach((film, i) => {
      const x = LABEL_W + (i % columns) * CARD_W
      const cy = y + Math.floor(i / columns) * CARD_H
      const image = images.get(film.id)
      if (image) drawCover(ctx, image, x, cy, CARD_W, CARD_H)
      else drawPlaceholder(ctx, film, x, cy, CARD_W, CARD_H)
    })

    ctx.fillStyle = '#000'
    ctx.fillRect(0, y + rowH - 1, width, 2)
    y += rowH
  })

  ctx.fillStyle = '#8899aa'
  ctx.font = `400 13px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(options.footer, width - 12, height - FOOTER_H / 2)

  images.forEach((image) => image.close())
  return canvasToBlob(canvas)
}
