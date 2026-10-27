import { runPool } from '../pool'
import { posterUrl } from '../tmdb/client'
import { champion, entrants, type Tournament } from '../tournament'
import type { Film, Match } from '../types'
import { FONT, canvasToBlob, createCanvas, drawCover, drawPlaceholder, loadBitmap, wrapText } from './canvas'

const PAD = 32
const HEADER_H = 110
const LABEL_H = 30
const FOOTER_H = 40
const ROW_H = 30
const BOX_H = ROW_H * 2
const PITCH = BOX_H + 12
const COL_W = 210
const COL_GAP = 32
const FINAL_W = 240
const CHAMP_W = 120
/** Champion label + poster + title + seed line, above the final. */
const CHAMP_BLOCK = 26 + CHAMP_W * 1.5 + 54
const MIN_WIDTH = 720

/** Text drawn on the image (translated by the caller). */
export interface BracketImageTexts {
  title: string
  subtitle: string
  champion: string
  /** "Final", "Semi-finals"… for a round index. */
  round: (round: number) => string
  bye: string
  seed: (seed: number) => string
  footer: string
}

export interface BracketBox {
  round: number
  match: number
  x: number
  /** Vertical centre. */
  y: number
  width: number
  side: 'left' | 'right' | 'final'
}

/**
 * Where every match goes: the first half of each round on the left, the second half mirrored on
 * the right, both converging on the final in the middle.
 */
export function bracketLayout(size: number) {
  const rounds = Math.round(Math.log2(size))
  const sideCols = rounds - 1
  const sideH = sideCols > 0 ? (size / 4) * PITCH : 0
  const width = Math.max(MIN_WIDTH, 2 * PAD + 2 * sideCols * (COL_W + COL_GAP) + FINAL_W)
  const top = HEADER_H + LABEL_H
  // The final sits level with the middle of both sides, low enough for the champion to fit above.
  const centerY = top + Math.max(sideH / 2, CHAMP_BLOCK + LABEL_H + BOX_H / 2)
  const sideTop = centerY - sideH / 2
  const height = centerY + Math.max(sideH, BOX_H) / 2 + PAD / 2 + FOOTER_H
  const finalX = (width - FINAL_W) / 2

  const boxes: BracketBox[] = []
  for (let round = 0; round < sideCols; round++) {
    const half = size / 2 ** (round + 2)
    const span = PITCH * 2 ** round
    for (let i = 0; i < half; i++) {
      const y = sideTop + (i + 0.5) * span
      boxes.push({ round, match: i, x: finalX - (sideCols - round) * (COL_W + COL_GAP), y, width: COL_W, side: 'left' })
      boxes.push({ round, match: half + i, x: finalX + FINAL_W + COL_GAP + (sideCols - 1 - round) * (COL_W + COL_GAP), y, width: COL_W, side: 'right' })
    }
  }
  boxes.push({ round: rounds - 1, match: 0, x: finalX, y: centerY, width: FINAL_W, side: 'final' })
  return { width, height, boxes, finalX, centerY, labelY: sideTop - LABEL_H / 2 }
}

/** Cuts text to fit, with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/** The whole bracket as one image, like the "Full bracket" view. */
export async function renderBracketPng(t: Tournament, matches: Record<string, Match>, texts: BracketImageTexts): Promise<Blob> {
  const seedOf = new Map(t.seeds.map((film, i) => [film.id, { film, seed: i + 1 }]))
  const winnerId = champion(t)
  const winner = winnerId ? seedOf.get(winnerId) : undefined

  const thumbs = new Map<string, ImageBitmap>()
  await runPool(t.seeds, 8, async (film: Film) => {
    const match = matches[film.id]
    if (match?.status !== 'matched' || !match.posterPath) return
    try {
      thumbs.set(film.id, await loadBitmap(posterUrl(match.posterPath, film.id === winnerId ? 'w342' : 'w92')))
    } catch {
      // Blank thumbnail / title card instead.
    }
  })

  const layout = bracketLayout(t.size)
  const { width, height } = layout
  const { canvas, ctx } = createCanvas(width, height)
  ctx.fillStyle = '#14181c'
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = `700 40px ${FONT}`
  ctx.fillText(fit(ctx, texts.title, width - 2 * PAD), width / 2, 48)
  ctx.fillStyle = '#99aabb'
  ctx.font = `400 18px ${FONT}`
  ctx.fillText(texts.subtitle, width / 2, 86)

  // Round names over each column.
  ctx.font = `600 13px ${FONT}`
  ctx.fillStyle = '#8899aa'
  const labelled = new Set<string>()
  for (const box of layout.boxes) {
    const key = `${box.side}-${box.round}`
    if (box.side === 'final' || labelled.has(key)) continue
    labelled.add(key)
    ctx.fillText(texts.round(box.round).toUpperCase(), box.x + box.width / 2, layout.labelY)
  }

  // Connectors first, so boxes sit on top. A decided match's line is green.
  const byKey = new Map(layout.boxes.map((box) => [`${box.round}-${box.match}`, box]))
  ctx.lineWidth = 2
  for (const box of layout.boxes) {
    if (box.side === 'final') continue
    const next = byKey.get(`${box.round + 1}-${box.match >> 1}`)
    if (!next) continue
    const fromX = box.side === 'left' ? box.x + box.width : box.x
    const toX = box.side === 'left' ? next.x : next.x + next.width
    const midX = (fromX + toX) / 2
    ctx.strokeStyle = t.picks[box.round][box.match] ? '#00b045' : '#2c3440'
    ctx.beginPath()
    ctx.moveTo(fromX, box.y)
    ctx.lineTo(midX, box.y)
    ctx.lineTo(midX, next.y)
    ctx.lineTo(toX, next.y)
    ctx.stroke()
  }

  for (const box of layout.boxes) {
    const top = box.y - BOX_H / 2
    const pickId = t.picks[box.round][box.match]
    ctx.fillStyle = '#1c2228'
    ctx.strokeStyle = box.side === 'final' ? '#ffd84a99' : '#2c3440'
    ctx.lineWidth = box.side === 'final' ? 2 : 1
    ctx.beginPath()
    ctx.roundRect(box.x, top, box.width, BOX_H, 6)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(box.x, top + ROW_H)
    ctx.lineTo(box.x + box.width, top + ROW_H)
    ctx.stroke()

    entrants(t, box.round, box.match).forEach((id, row) => {
      const y = top + row * ROW_H
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      if (!id) {
        // Only the first round has byes; later empty slots are matches not played yet.
        if (box.round > 0) return
        ctx.fillStyle = '#667788'
        ctx.font = `italic 400 12px ${FONT}`
        ctx.fillText(texts.bye, box.x + 10, y + ROW_H / 2)
        return
      }
      const entry = seedOf.get(id)!
      const thumb = thumbs.get(id)
      ctx.fillStyle = '#2c3440'
      ctx.fillRect(box.x + 6, y + 3, 16, 24)
      if (thumb) drawCover(ctx, thumb, box.x + 6, y + 3, 16, 24)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#778899'
      ctx.font = `400 11px ${FONT}`
      ctx.fillText(`#${entry.seed}`, box.x + 54, y + ROW_H / 2)
      ctx.textAlign = 'left'
      const won = pickId === id
      ctx.fillStyle = won ? '#00e054' : pickId ? '#778899' : '#e1e7ec'
      ctx.font = `${won ? 700 : 400} 13px ${FONT}`
      ctx.fillText(fit(ctx, entry.film.name, box.width - 66), box.x + 60, y + ROW_H / 2)
    })
  }

  // Final label, and the champion above it.
  const finalTop = layout.centerY - BOX_H / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#8899aa'
  ctx.font = `600 13px ${FONT}`
  ctx.fillText(texts.round(t.picks.length - 1).toUpperCase(), layout.finalX + FINAL_W / 2, finalTop - LABEL_H / 2)
  if (winner) {
    const cx = layout.finalX + FINAL_W / 2
    const blockTop = finalTop - LABEL_H - CHAMP_BLOCK
    ctx.fillStyle = '#ffd84a'
    ctx.font = `700 20px ${FONT}`
    ctx.fillText(texts.champion.toUpperCase(), cx, blockTop + 12)
    const posterTop = blockTop + 26
    const posterH = CHAMP_W * 1.5
    const thumb = thumbs.get(winner.film.id)
    if (thumb) drawCover(ctx, thumb, cx - CHAMP_W / 2, posterTop, CHAMP_W, posterH)
    else drawPlaceholder(ctx, winner.film, cx - CHAMP_W / 2, posterTop, CHAMP_W, posterH)
    ctx.strokeStyle = '#ffd84a'
    ctx.lineWidth = 3
    ctx.strokeRect(cx - CHAMP_W / 2 - 1.5, posterTop - 1.5, CHAMP_W + 3, posterH + 3)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#fff'
    ctx.font = `700 16px ${FONT}`
    const [line] = wrapText(ctx, winner.film.name, FINAL_W + COL_GAP, 1)
    ctx.fillText(line, cx, posterTop + posterH + 8)
    ctx.fillStyle = '#99aabb'
    ctx.font = `400 12px ${FONT}`
    ctx.fillText(`${texts.seed(winner.seed)}${winner.film.year ? ` · ${winner.film.year}` : ''}`, cx, posterTop + posterH + 30)
  }

  ctx.fillStyle = '#8899aa'
  ctx.font = `400 13px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(texts.footer, width - 16, height - FOOTER_H / 2)

  thumbs.forEach((image) => image.close())
  return canvasToBlob(canvas)
}
