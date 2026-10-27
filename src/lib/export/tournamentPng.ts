import { runPool } from '../pool'
import { posterUrl } from '../tmdb/client'
import { standings, type Tournament } from '../tournament'
import type { Film, Match } from '../types'
import { FONT, canvasToBlob, createCanvas, drawCover, drawPlaceholder, loadBitmap, wrapText } from './canvas'

const WIDTH = 1080
const GAP = 24
const HEADER_H = 110
const FOOTER_H = 40
const CAPTION_H = 64
const LABEL_H = 44

/** Text drawn on the image (translated by the caller). */
export interface TournamentImageTexts {
  title: string
  /** e.g. "8 films · 7 matches" */
  subtitle: string
  champion: string
  runnerUp: string
  semiFinalists: string
  quarterFinalists: string
  /** e.g. "#3 seed" */
  seed: (seed: number) => string
  footer: string
}

/** Podium-style image: champion, runner-up, semi-finalists and quarter-finalists. */
export async function renderTournamentPng(t: Tournament, matches: Record<string, Match>, texts: TournamentImageTexts): Promise<Blob> {
  const filmById = new Map(t.seeds.map((f, i) => [f.id, { film: f, seed: i + 1 }]))
  const results = standings(t)
  const rows = [
    { label: texts.champion, width: 280, place: 1 },
    { label: texts.runnerUp, width: 200, place: 2 },
    { label: texts.semiFinalists, width: 170, place: 3 },
    { label: texts.quarterFinalists, width: 150, place: 5 },
  ]
    .map((row) => ({ ...row, films: results.filter((s) => s.place === row.place).map((s) => filmById.get(s.filmId)!) }))
    .filter((row) => row.films.length > 0)

  const films = rows.flatMap((row) => row.films.map((entry) => entry.film))
  const images = new Map<string, ImageBitmap>()
  await runPool(films, 8, async (film: Film) => {
    const match = matches[film.id]
    if (match?.status !== 'matched' || !match.posterPath) return
    try {
      images.set(film.id, await loadBitmap(posterUrl(match.posterPath, 'w342')))
    } catch {
      // Title card instead.
    }
  })

  const rowHeight = (width: number) => LABEL_H + width * 1.5 + CAPTION_H + GAP
  const height = HEADER_H + rows.reduce((sum, row) => sum + rowHeight(row.width), 0) + FOOTER_H
  const { canvas, ctx } = createCanvas(WIDTH, height)
  ctx.fillStyle = '#14181c'
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = `700 40px ${FONT}`
  ctx.fillText(texts.title, WIDTH / 2, 48)
  ctx.fillStyle = '#99aabb'
  ctx.font = `400 18px ${FONT}`
  ctx.fillText(texts.subtitle, WIDTH / 2, 86)

  let y = HEADER_H
  for (const row of rows) {
    const cardH = row.width * 1.5
    const total = row.films.length * row.width + (row.films.length - 1) * GAP
    // Quarter-finalists can overflow at 4 × 150 + gaps on narrow widths; scale the row down if needed.
    const scale = Math.min(1, (WIDTH - 2 * GAP) / total)
    const w = row.width * scale
    const h = cardH * scale
    let x = (WIDTH - total * scale) / 2

    ctx.fillStyle = row.place === 1 ? '#ffd84a' : '#00e054'
    ctx.font = `700 ${row.place === 1 ? 24 : 18}px ${FONT}`
    ctx.textBaseline = 'middle'
    ctx.fillText(row.label.toUpperCase(), WIDTH / 2, y + LABEL_H / 2)

    for (const { film, seed } of row.films) {
      const top = y + LABEL_H
      const image = images.get(film.id)
      if (image) drawCover(ctx, image, x, top, w, h)
      else drawPlaceholder(ctx, film, x, top, w, h)
      if (row.place === 1) {
        ctx.strokeStyle = '#ffd84a'
        ctx.lineWidth = 4
        ctx.strokeRect(x - 2, top - 2, w + 4, h + 4)
      }
      ctx.fillStyle = '#e1e7ec'
      ctx.font = `600 ${row.place === 1 ? 18 : 14}px ${FONT}`
      ctx.textBaseline = 'top'
      const lines = wrapText(ctx, film.name, w + GAP - 8, 2)
      lines.forEach((line, i) => ctx.fillText(line, x + w / 2, top + h + 8 + i * 18))
      ctx.fillStyle = '#99aabb'
      ctx.font = `400 12px ${FONT}`
      ctx.fillText(`${texts.seed(seed)}${film.year ? ` · ${film.year}` : ''}`, x + w / 2, top + h + 10 + lines.length * 18)
      x += w + GAP * scale
    }
    y += rowHeight(row.width) - (cardH - h)
  }

  ctx.fillStyle = '#8899aa'
  ctx.font = `400 13px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(texts.footer, WIDTH - 16, height - FOOTER_H / 2)

  images.forEach((image) => image.close())
  return canvasToBlob(canvas)
}
