import { stars } from '../ratings'
import type { Film } from '../types'

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export async function loadBitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Image request failed (${res.status})`)
  return createImageBitmap(await res.blob())
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality),
  )
}

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return { canvas, ctx: canvas.getContext('2d')! }
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}

/** Draws `img` scaled to cover the box, cropping the overflow. */
export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/** Title card used when a film has no poster. */
export function drawPlaceholder(ctx: CanvasRenderingContext2D, film: Film, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2c3440'
  ctx.fillRect(x, y, w, h)
  const size = Math.round(w / 8)
  ctx.font = `600 ${size}px ${FONT}`
  ctx.fillStyle = '#e1e7ec'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = wrapText(ctx, film.name, w * 0.86, 5)
  const lineHeight = size * 1.2
  const top = y + h / 2 - ((lines.length - 1) * lineHeight) / 2 - (film.year ? lineHeight / 2 : 0)
  lines.forEach((line, i) => ctx.fillText(line, x + w / 2, top + i * lineHeight))
  if (film.year) {
    ctx.font = `400 ${Math.round(size * 0.85)}px ${FONT}`
    ctx.fillStyle = '#9ab'
    ctx.fillText(String(film.year), x + w / 2, top + lines.length * lineHeight + lineHeight * 0.2)
  }
}

/** Dark band at the bottom of a poster with the title, and optionally the rating. */
export function drawCaption(ctx: CanvasRenderingContext2D, film: Film, withRating: boolean, x: number, y: number, w: number, h: number) {
  const size = Math.round(w / 12)
  ctx.font = `600 ${size}px ${FONT}`
  const lines = wrapText(ctx, film.year ? `${film.name} (${film.year})` : film.name, w * 0.9, 2)
  const lineHeight = size * 1.25
  const bandHeight = lineHeight * (lines.length + (withRating ? 1 : 0)) + size * 0.8
  const gradient = ctx.createLinearGradient(0, y + h - bandHeight - size, 0, y + h)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(0.25, 'rgba(0,0,0,0.75)')
  gradient.addColorStop(1, 'rgba(0,0,0,0.9)')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y + h - bandHeight - size, w, bandHeight + size)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#fff'
  let lineY = y + h - bandHeight + size * 0.4
  for (const line of lines) {
    ctx.fillText(line, x + w / 2, lineY)
    lineY += lineHeight
  }
  if (withRating) {
    ctx.fillStyle = film.rating == null ? '#9ab' : '#00e054'
    ctx.fillText(stars(film.rating), x + w / 2, lineY)
  }
}

/** Black or white, whichever reads better on `hex`. */
export function textColorFor(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000' : '#fff'
}
