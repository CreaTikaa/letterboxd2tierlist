import JSZip from 'jszip'
import fs from 'node:fs'
import { addTmdbKey, drag, expect, fixtures, importExport, showing, test, tierCards, TMDB_KEY, type Page, waitForSave } from './support'

const pool = (page: Page) => page.locator('h2:has-text("Unplaced")').locator('xpath=../..').locator('[title]')

test('import, posters, filters, auto-fill, drag, edit and export', async ({ page }) => {
  // Tall enough for the pool and the top tier to be on screen together while dragging.
  await page.setViewportSize({ width: 1400, height: 1800 })
  await page.goto('/')
  await expect(page.getByText('Drop your Letterboxd export ZIP here')).toBeVisible()
  await importExport(page, await fixtures.alice())
  await expect(page.getByText('80 films', { exact: true })).toBeVisible()
  await expect(page.getByText('Imported 80 films (72 rated, 4 liked) and 2 lists.')).toBeVisible()
  await expect(page.getByTitle(/Ghost Film/)).toHaveCount(0)
  await expect(page.getByText('Add a free TMDB API key')).toBeVisible()

  // A wrong key is rejected, a good one loads posters.
  await page.getByRole('button', { name: 'Add TMDB key' }).click()
  await page.getByPlaceholder('Paste your TMDB key').fill('wrong-key')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Invalid TMDB API key')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await addTmdbKey(page)
  await expect.poll(() => page.locator('main img').count()).toBeGreaterThanOrEqual(79)
  await expect(page.getByText(/1 film without a poster/)).toBeVisible()

  // Rating filters.
  await page.locator('button[aria-pressed]', { hasText: 'Unrated' }).click()
  expect(await showing(page)).toBe(72)
  await page.getByRole('button', { name: '4★+' }).click()
  expect(await showing(page)).toBeLessThan(72)
  await page.getByRole('button', { name: 'All', exact: true }).click()

  // Genres (from the mocked TMDB data).
  const all = await showing(page)
  await page.getByRole('button', { name: /^Horror \d+/ }).click()
  const horror = await showing(page)
  await page.getByRole('button', { name: /^Comedy \d+/ }).click()
  const both = await showing(page)
  expect(horror).toBeLessThan(all)
  expect(both).toBeGreaterThan(horror)
  await page.getByRole('button', { name: 'Any', exact: true }).click()
  expect(await showing(page)).toBe(all)

  // Auto-fill leaves only the unrated films in the pool.
  await page.getByRole('button', { name: '★ Auto-fill by rating' }).click()
  await page.getByRole('button', { name: /Apply to 80 visible films/ }).click()
  await expect(page.locator('h2:has-text("Unplaced")')).toContainText('(8)')

  // Drag from the pool into S, then back out.
  const sBefore = await tierCards(page, 0).count()
  const card = pool(page).first()
  await card.scrollIntoViewIfNeeded()
  const from = (await card.boundingBox())!
  const row = (await page.locator('[data-tier]').first().locator('.flex-1').boundingBox())!
  await drag(page, { x: from.x + from.width / 2, y: from.y + from.height / 2 }, { x: row.x + row.width - 40, y: row.y + row.height / 2 })
  await expect(tierCards(page, 0)).toHaveCount(sBefore + 1)

  // Reorder inside S: last card to the front.
  const titles = () => tierCards(page, 0).evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  const before = await titles()
  const last = (await tierCards(page, 0).last().boundingBox())!
  const first = (await tierCards(page, 0).first().boundingBox())!
  await drag(page, { x: last.x + last.width / 2, y: last.y + last.height / 2 }, { x: first.x + 5, y: first.y + first.height / 2 })
  await expect.poll(async () => (await titles())[0]).toBe(before.at(-1))

  // Reload keeps everything.
  const sCount = await tierCards(page, 0).count()
  await waitForSave(page)
  await page.reload()
  await expect(page.getByText('80 films', { exact: true })).toBeVisible()
  await expect(tierCards(page, 0)).toHaveCount(sCount)

  // Tiers can be added and renamed.
  await page.getByRole('button', { name: '+ Add tier' }).click()
  await expect(page.locator('textarea[aria-label="Tier name"]')).toHaveCount(7)
  await page.locator('textarea[aria-label="Tier name"]').first().fill('GOAT')
  await expect(page.locator('textarea[aria-label="Tier name"]').first()).toHaveValue('GOAT')
  // Even a reload right after a change (before the batched save) keeps it.
  await page.reload()
  await expect(page.locator('textarea[aria-label="Tier name"]')).toHaveCount(7)
  await expect(page.locator('textarea[aria-label="Tier name"]').first()).toHaveValue('GOAT')

  // Fix a poster by TMDB URL (poster → Details).
  await tierCards(page, 0).first().click()
  await page.getByRole('toolbar').getByRole('button', { name: 'Details' }).click()
  await page.getByPlaceholder('Title, TMDB id or TMDB URL').fill('https://www.themoviedb.org/movie/550-fight-club')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByTitle('Use this film').first().click()
  await expect(page.locator('img[src*="manual.jpg"]')).toHaveCount(1)
  await page.keyboard.press('Escape')

  // Exports.
  await page.getByRole('button', { name: 'Export' }).click()
  let [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()])
  expect(fs.statSync((await download.path())!).size).toBeGreaterThan(10_000)

  await page.locator('select').filter({ hasText: 'None (original posters)' }).selectOption('title-rating')
  ;[download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download ZIP/ }).click()])
  const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!))
  const names = Object.keys(zip.files)
  expect(names).toHaveLength(81)
  expect(names.filter((n) => n.startsWith('Dune'))).toHaveLength(2)

  ;[download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download save (.json)' }).click()])
  const save = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'))
  expect(save.app).toBe('letterboxd2tierlist')
  expect(save.films).toHaveLength(80)
  await page.getByRole('button', { name: 'Close' }).click()

  // Phone width: no sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})

test('tap to place, keyboard shortcuts and undo/redo', async ({ page }) => {
  await page.goto('/')
  await importExport(page, await fixtures.alice())
  await expect(page.getByText('80 films', { exact: true })).toBeVisible()

  // Tap a poster, then a tier in the toolbar.
  const first = pool(page).first()
  const name = await first.getAttribute('title')
  await first.click()
  const toolbar = page.getByRole('toolbar')
  await expect(toolbar).toBeVisible()
  await toolbar.getByRole('button', { name: 'S', exact: true }).click()
  await expect(tierCards(page, 0)).toHaveCount(1)
  expect(await tierCards(page, 0).first().getAttribute('title')).toBe(name)
  // The next pool film is selected right away, so films can be sorted tap after tap.
  await expect(toolbar).toBeVisible()

  // Keys 1–9 pick a tier, 0 sends back to the pool.
  await page.keyboard.press('2')
  await expect(tierCards(page, 1)).toHaveCount(1)
  await page.keyboard.press('2')
  await expect(tierCards(page, 1)).toHaveCount(2)

  // Tapping the empty part of a row places the selected film there.
  const row = (await page.locator('[data-tier]').nth(3).locator('.flex-1').boundingBox())!
  await page.mouse.click(row.x + row.width - 20, row.y + row.height / 2)
  await expect(tierCards(page, 3)).toHaveCount(1)

  // Select a placed film and unplace it.
  await tierCards(page, 3).first().click()
  await page.keyboard.press('0')
  await expect(tierCards(page, 3)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(toolbar).toHaveCount(0)

  // Ctrl+Z walks back, Ctrl+Shift+Z replays.
  await page.keyboard.press('Control+z')
  await expect(tierCards(page, 3)).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(tierCards(page, 3)).toHaveCount(0)
  await expect(tierCards(page, 1)).toHaveCount(2)
  await page.keyboard.press('Control+Shift+z')
  await expect(tierCards(page, 3)).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click()
  await expect(tierCards(page, 3)).toHaveCount(0)

  // Typing a tier name is one undo step, and Ctrl+Z inside the field is left to the browser.
  const label = page.locator('textarea[aria-label="Tier name"]').first()
  await label.fill('Masterpieces')
  await page.locator('h2:has-text("Unplaced")').click()
  await page.keyboard.press('Control+z')
  await expect(label).toHaveValue('S')

  // Ctrl+F finds a film (accents optional), says where it is and selects it.
  await page.keyboard.press('Control+f')
  const find = page.getByRole('combobox', { name: 'Find a film on the board' })
  const results = page.getByRole('listbox').getByRole('option')
  await expect(find).toBeFocused()
  await find.fill('amelie')
  await expect(results).toHaveText([/^Amélie 2001\s*Unplaced$/])
  await find.press('Enter')
  await expect(page.getByRole('toolbar', { name: 'Move Amélie to…' })).toBeVisible()
  await expect(page.locator('[data-selected] [title^="Amélie"]')).toBeInViewport()
  await page.keyboard.press('1')
  await expect(page.locator('[data-tier]').first().locator('[title^="Amélie"]')).toHaveCount(1)
  await find.fill('AMÉL')
  await expect(results).toHaveText([/^Amélie 2001\s*S$/])
  await find.fill('zzz')
  await expect(results).toHaveCount(0)
  await expect(page.getByText('No film here matches.', { exact: false })).toBeVisible()
  await find.press('Escape')
  await expect(find).toHaveValue('')

  // Mobile: the toolbar stays usable on a phone.
  await page.setViewportSize({ width: 390, height: 844 })
  await pool(page).first().click()
  await expect(toolbar).toBeInViewport()
  await toolbar.getByRole('button', { name: 'A', exact: true }).click()
  await expect(tierCards(page, 1)).toHaveCount(3)
})

test('likes, lists and the director / actor filter', async ({ page }) => {
  await page.goto('/')
  await importExport(page, await fixtures.alice())
  await expect(page.getByText('80 films', { exact: true })).toBeVisible()

  const source = page.locator('main select').filter({ hasText: 'All watched' })
  // A list without its header block is named after its file.
  await expect(source.locator('option')).toHaveText(['All watched (80)', 'Liked ♥ (4)', 'Guilty pleasures (2)', 'Sci-fi favourites (3)'])
  await source.selectOption({ label: 'Liked ♥ (4)' })
  expect(await showing(page)).toBe(4)
  // Lists can hold films you haven't logged.
  await source.selectOption({ label: 'Sci-fi favourites (3)' })
  expect(await showing(page)).toBe(3)
  await expect(page.getByTitle(/^Arrival/)).toBeVisible()
  await source.selectOption('all')

  // People need TMDB.
  await expect(page.getByLabel('People')).toBeDisabled()
  await page.getByRole('button', { name: 'Add TMDB key' }).click()
  await page.getByPlaceholder('Paste your TMDB key').fill(TMDB_KEY)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Key works')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Finding posters')).toHaveCount(0, { timeout: 30_000 })

  const people = page.getByLabel('People')
  await people.click()
  await people.fill('weav')
  await page.getByRole('button', { name: /Sigourney Weavers/ }).click()
  // The mock gives every found film the same actor: everything but the one not on TMDB.
  expect(await showing(page)).toBe(79)
  await page.getByRole('button', { name: 'Remove person filter' }).click()
  await people.click()
  await people.fill('bong')
  await page.getByRole('button', { name: /Bong Jun/ }).click()
  const directed = await showing(page)
  expect(directed).toBeGreaterThan(0)
  expect(directed).toBeLessThan(79)
})
