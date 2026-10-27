import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import JSZip from 'jszip'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

// ---------------------------------------------------------------- fixtures

interface FixtureFilm {
  id: string
  name: string
  year: number
  rating: number | null
}

const NAMED: [string, number, number | null][] = [
  ['Parasite', 2019, 5],
  ['Dune', 2021, 4],
  ['Dune', 1984, 2],
  ['Crouching Tiger, Hidden Dragon', 2000, 4.5],
  ['Amélie', 2001, 4],
  ['Cats', 2019, 0.5],
  ['The Room', 2003, 1],
  ['Heat', 1995, 4.5],
  ['Alien', 1979, 5],
  ['Brazil', 1985, 3.5],
  ['Spirited Away', 2001, 5],
  ['Mission: Impossible - Fallout', 2018, 4],
  ['Tenet', 2020, 3],
  ['Morbius', 2022, 1.5],
  ['Barbie', 2023, 3.5],
  ['Oppenheimer', 2023, 4],
  ['Unrated One', 1999, null],
  ['Unrated Two', 2010, null],
  ['Her', 2013, 4.5],
  ['Up', 2009, 4],
]
const RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, null]

/** Alice's library: 20 named films + 60 fillers with deterministic ratings (72 rated). */
export const ALICE_FILMS: FixtureFilm[] = [
  ...NAMED.map(([name, year, rating], i) => ({ id: `https://boxd.it/x${String(i).padStart(3, '0')}`, name, year, rating })),
  ...Array.from({ length: 60 }, (_, i) => ({
    id: `https://boxd.it/x${String(i + 20).padStart(3, '0')}`,
    name: `Filler Film ${i}`,
    year: 1990 + (i % 30),
    // Exactly 6 unrated fillers (every 10th).
    rating: i % 10 === 9 ? null : RATINGS[i % 10],
  })),
]

const byName = (name: string, year?: number) => ALICE_FILMS.find((f) => f.name === name && (year == null || f.year === year))!

/** Bob shares 12 films with Alice (different ratings) and has 3 of his own. */
export const BOB_FILMS: FixtureFilm[] = [
  ...(
    [
      ['Parasite', 3],
      ['Alien', 4],
      ['Heat', 3.5],
      ['Her', 2],
      ['Up', 4.5],
      ['Barbie', 4],
      ['Oppenheimer', 3],
      ['Spirited Away', 5],
      ['Tenet', 1.5],
      ['Cats', 0.5],
      ['Morbius', 1],
    ] as const
  ).map(([name, rating]) => ({ ...byName(name), rating })),
  { ...byName('Dune', 2021), rating: 5 },
  { id: 'https://boxd.it/bob0', name: 'Bob Only One', year: 2015, rating: 4 },
  { id: 'https://boxd.it/bob1', name: 'Bob Only Two', year: 2016, rating: 2 },
  { id: 'https://boxd.it/bob2', name: 'Bob Unrated', year: 2017, rating: null },
]

/** Carol has seen 8 of the films Alice and Bob both saw. */
export const CAROL_FILMS: FixtureFilm[] = [
  ...(
    [
      ['Parasite', 4],
      ['Alien', 5],
      ['Heat', 4],
      ['Her', 3.5],
      ['Up', 5],
      ['Barbie', 2],
      ['Spirited Away', 4.5],
    ] as const
  ).map(([name, rating]) => ({ ...byName(name), rating })),
  { ...byName('Dune', 2021), rating: 3 },
  { id: 'https://boxd.it/carol0', name: 'Carol Only', year: 2012, rating: 3 },
]

const csvName = (name: string) => (name.includes(',') ? `"${name}"` : name)

async function exportZip(films: FixtureFilm[], extras: Record<string, string> = {}): Promise<string> {
  const watched = ['Date,Name,Year,Letterboxd URI', ...films.map((f, i) => `2024-01-${String((i % 28) + 1).padStart(2, '0')},${csvName(f.name)},${f.year},${f.id}`)]
  const ratings = ['Date,Name,Year,Letterboxd URI,Rating', ...films.filter((f) => f.rating != null).map((f) => `2024-02-01,${csvName(f.name)},${f.year},${f.id},${f.rating}`)]
  const zip = new JSZip()
  zip.file('watched.csv', watched.join('\n') + '\n')
  zip.file('ratings.csv', ratings.join('\n') + '\n')
  zip.file('diary.csv', 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n')
  // Deleted entries must be ignored.
  zip.file('deleted/ratings.csv', 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-01,Ghost Film,2000,https://boxd.it/ghost,5\n')
  for (const [file, content] of Object.entries(extras)) zip.file(file, content)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb2tl-'))
  const file = path.join(dir, 'letterboxd-export.zip')
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }))
  return file
}

export const fixtures = {
  /** 80 films, 72 rated; 4 likes; two lists (one with a film Alice hasn't seen). */
  alice: () =>
    exportZip(ALICE_FILMS, {
      'likes/films.csv': ['Date,Name,Year,Letterboxd URI', ...['Alien', 'Heat', 'Her', 'Up'].map((n) => `2024-03-01,${n},${byName(n).year},${byName(n).id}`)].join('\n') + '\n',
      'lists/sci-fi-favourites.csv': [
        'Letterboxd list export v7',
        'Date,Name,Tags,URL,Description',
        '2024-01-01,Sci-fi favourites,,https://letterboxd.com/alice/list/sci-fi-favourites/,',
        '',
        'Position,Name,Year,URL,Description',
        `1,Alien,1979,${byName('Alien').id},`,
        `2,Dune,2021,${byName('Dune', 2021).id},`,
        '3,Arrival,2016,https://boxd.it/notwatched,',
        '',
      ].join('\n'),
      'lists/guilty-pleasures.csv': ['Position,Name,Year,URL', `1,Cats,2019,${byName('Cats').id}`, `2,Morbius,2022,${byName('Morbius').id}`, ''].join('\n'),
    }),
  bob: () => exportZip(BOB_FILMS),
  carol: () => exportZip(CAROL_FILMS),
}

// ---------------------------------------------------------------- TMDB mock

export const TMDB_KEY = 'test-key-123'
const GENRE_SETS = [[28, 18], [35], [27, 53], [878]]
const DIRECTORS: [number, string][] = [
  [101, 'Denise Villeneuve'],
  [102, 'Bong Jun'],
  [103, 'Greta Gerwick'],
]

function crc32(buf: Buffer) {
  let crc = 0xffffffff
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typed = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([len, typed, crc])
}

/** A small solid-colour PNG used as every poster. */
function png(seed: number) {
  const [w, h] = [40, 60]
  const header = Buffer.alloc(13)
  header.writeUInt32BE(w, 0)
  header.writeUInt32BE(h, 4)
  header[8] = 8
  header[9] = 2
  const row = Buffer.alloc(1 + w * 3)
  for (let x = 0; x < w; x++) row.set([(seed * 37) % 255, (seed * 91) % 255, (seed * 53) % 255], 1 + x * 3)
  const raw = Buffer.concat(Array.from({ length: h }, () => row))
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const idFor = (title: string) => [...title].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 7)

/** Fake TMDB: search, details and credits, deterministic per title; "Unrated Two" is never found. */
export async function mockTmdb(context: BrowserContext) {
  await context.route('https://api.themoviedb.org/3/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('api_key') !== TMDB_KEY) return route.fulfill({ status: 401, json: { status_message: 'Invalid API key' } })
    if (url.pathname.endsWith('/configuration')) return route.fulfill({ json: { images: {} } })
    const credits = url.pathname.match(/\/movie\/(\d+)\/credits$/)
    if (credits) {
      const id = Number(credits[1])
      const director = DIRECTORS[id % DIRECTORS.length]
      return route.fulfill({
        json: {
          crew: [{ id: director[0], name: director[1], job: 'Director' }],
          cast: [
            { id: 201, name: 'Sigourney Weavers', order: 0 },
            { id: 202 + (id % 3), name: `Actor ${id % 3}`, order: 1 },
          ],
        },
      })
    }
    const details = url.pathname.match(/\/movie\/(\d+)$/)
    if (details) {
      const id = Number(details[1])
      return route.fulfill({ json: { id, title: 'Picked By Id', original_title: 'Picked By Id', release_date: '1999-01-01', poster_path: '/manual.jpg', genres: [{ id: 99, name: 'Documentary' }] } })
    }
    const query = url.searchParams.get('query') ?? ''
    const year = url.searchParams.get('primary_release_year') ?? url.searchParams.get('year') ?? '2000'
    if (query === 'Unrated Two') return route.fulfill({ json: { results: [] } })
    const id = idFor(query)
    return route.fulfill({
      json: { results: [{ id, title: query, original_title: query, release_date: `${year}-05-01`, poster_path: `/p${id}.jpg`, popularity: 10, genre_ids: GENRE_SETS[id % 4] }] },
    })
  })
  await context.route('https://image.tmdb.org/**', (route) => route.fulfill({ contentType: 'image/png', body: png(route.request().url().length) }))
}

// ---------------------------------------------------------------- helpers

/** `test` with TMDB mocked, dialogs accepted, and a check that the page threw no errors. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ context, page }, use) => {
      await mockTmdb(context)
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('dialog', (d) => void d.accept())
      await use(errors)
      expect(errors).toEqual([])
    },
    { auto: true },
  ],
})
export { expect, type Page }

export interface User {
  page: Page
  errors: string[]
}

/** A separate browser profile (its own storage), with TMDB mocked and dialogs accepted. */
export async function newUser(browser: Browser, { locale = 'en-US' } = {}): Promise<User> {
  // Tall, so a whole board (all tiers) fits on screen for drags.
  const context = await browser.newContext({ locale, viewport: { width: 1300, height: 1600 } })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await mockTmdb(context)
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => void d.accept())
  return { page, errors }
}

/** Someone with nothing imported and no TMDB key (posters in shared links come from the link itself). */
export async function strangerPage(browser: Browser) {
  const context = await browser.newContext({ locale: 'en-US' })
  await context.route('https://image.tmdb.org/**', (route) => route.fulfill({ status: 404 }))
  await context.route('https://api.themoviedb.org/**', (route) => route.abort())
  return context.newPage()
}

export async function importExport(page: Page, file: string) {
  await page.locator('main input[type=file]').first().setInputFiles(file)
}

export async function addTmdbKey(page: Page) {
  await page.getByRole('button', { name: 'Add TMDB key' }).click()
  await page.getByPlaceholder('Paste your TMDB key').fill(TMDB_KEY)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Key works')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Finding posters')).toHaveCount(0, { timeout: 30_000 })
}

/** Posters inside a tier row (not counting the row's own buttons). */
export const tierCards = (page: Page, index: number) => page.locator('[data-tier]').nth(index).locator('.flex-1 [title]')

/** Saves are batched for 150 ms; a test can reload faster than any person could. */
export const waitForSave = (page: Page) => page.waitForTimeout(400)

/** Shows only the 5★ films on the tier list. */
export async function onlyFiveStars(page: Page) {
  await page.getByRole('button', { name: 'None', exact: true }).click()
  await page.getByTitle('5 stars', { exact: true }).click()
}

export const showing = async (page: Page) => Number((await page.getByText(/^Showing/).innerText()).match(/Showing (\d+)/)![1])

export async function readClipboard(page: Page) {
  return page.evaluate(() => navigator.clipboard.readText())
}

/** Drags with the mouse, in steps, so dnd-kit sees a real drag. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 15, from.y + ((to.y - from.y) * i) / 15)
  await page.waitForTimeout(150)
  await page.mouse.up()
}
