import fs from 'node:fs'
import { addTmdbKey, copyLink, expect, fixtures, importExport, onlyFiveStars, strangerPage, test, tierCards, waitForSave } from './support'

test('solo tournament: play, undo, bracket, share, send to tier list', async ({ page, browser }) => {
  await page.goto('/')
  await importExport(page, await fixtures.alice())
  await addTmdbKey(page)
  await page.getByRole('link', { name: 'Tournament' }).click()
  await expect(page.getByText('Film tournament')).toBeVisible()

  const setting = (label: string) => page.locator('main label', { hasText: label }).locator('select')
  await setting('Minimum rating').selectOption('4')
  await setting('Bracket size').selectOption('8')
  await expect(page.getByText(/^8 films · 7 matches/)).toBeVisible()
  await page.getByRole('button', { name: 'Start tournament' }).click()
  await expect(page.getByText('Quarter-finals')).toBeVisible()

  await page.locator('main button:has-text("seed")').first().click()
  await expect(page.getByText('1 / 7 matches played')).toBeVisible()
  await page.keyboard.press('z')
  await expect(page.getByText('0 / 7 matches played')).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect(page.getByText('0 / 7 matches played')).toBeVisible()
  for (let i = 0; i < 7; i++) {
    await expect(page.getByText(`${i} / 7 matches played`)).toBeVisible()
    await page.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowLeft')
  }
  await expect(page.getByText('🏆 Champion').first()).toBeVisible()
  const champion = await page.locator('main h1').last().innerText()

  // Z on the results screen takes back the final.
  await page.keyboard.press('z')
  await expect(page.getByText('6 / 7 matches played')).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByText('🏆 Champion').first()).toBeVisible()

  // The full bracket: 4 + 2 + 1 matches, plus the champion.
  await page.getByText('Full bracket').click()
  await expect(page.locator('details .divide-y')).toHaveCount(7)

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download image' }).click()])
  expect(fs.statSync((await download.path())!).size).toBeGreaterThan(10_000)
  const [bracketImage] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download bracket image' }).click()])
  expect(bracketImage.suggestedFilename()).toMatch(/^bracket-.*\.png$/)
  expect(fs.statSync((await bracketImage.path())!).size).toBeGreaterThan(10_000)

  // Share link, opened by someone with no data and no TMDB key.
  const link = await copyLink(page, page.getByRole('button', { name: 'Share link' }))
  await expect(page.getByText(/Link copied/)).toBeVisible()
  expect(link).toMatch(/#\/view\/[A-Za-z0-9_-]+$/)
  const stranger = await strangerPage(browser)
  await stranger.goto(link)
  await expect(stranger.getByText('My Letterboxd tournament')).toBeVisible()
  await expect(stranger.locator('main h1').last()).toHaveText(champion)
  await stranger.getByText('Full bracket').click()
  await expect(stranger.locator('details .divide-y')).toHaveCount(7)
  await stranger.context().close()

  // Reload keeps the result; send it to the tier list.
  await waitForSave(page)
  await page.reload()
  await expect(page.getByText('🏆 Champion').first()).toBeVisible()
  await page.getByRole('button', { name: '→ Send to my tier list' }).click()
  await expect(tierCards(page, 0)).toHaveCount(1)
  expect(await tierCards(page, 0).first().getAttribute('title')).toContain(champion)
  await expect(tierCards(page, 3)).toHaveCount(4)

  // The result compares with a tier list: how far each film got becomes its tier.
  await page.goto(link)
  await page.getByRole('button', { name: 'With my tier list' }).click()
  await expect(page.getByText(/^agreement on 8 films in common/)).toBeVisible()
  await expect(page.getByText(/^\d+%$/)).toBeVisible()
  await expect(page.getByText('Runner-up', { exact: true }).first()).toBeVisible()
})

test('tournament from a list or from the films shown on the tier list', async ({ page }) => {
  await page.goto('/')
  await importExport(page, await fixtures.alice())
  await expect(page.getByText('80 films', { exact: true })).toBeVisible()
  await onlyFiveStars(page)
  await page.goto('/#/tournament')

  const source = page.locator('main select').filter({ hasText: 'All watched' })
  await source.selectOption({ label: 'Guilty pleasures (2)' })
  await expect(page.getByText(/^2 films · 1 match/)).toBeVisible()
  await source.selectOption('visible')
  const shown = await source.locator('option:checked').innerText()
  const count = Number(shown.match(/\((\d+)\)/)![1])
  expect(count).toBeGreaterThan(2)
  expect(count).toBeLessThan(80)
})

test('rank everything: break ties, undo, share, send to tier list', async ({ page, browser }) => {
  await page.goto('/')
  await importExport(page, await fixtures.alice())
  await expect(page.getByText('80 films', { exact: true })).toBeVisible()
  // Rank a small slice: the 5★ films.
  await onlyFiveStars(page)
  const fives = Number((await page.getByText(/^Showing/).innerText()).match(/Showing (\d+)/)![1])

  await page.getByRole('link', { name: 'Rank' }).click()
  await expect(page.getByText(`Ranks the ${fives} films`)).toBeVisible()
  await page.getByText('Full ranking').click()
  await page.getByRole('button', { name: 'Start ranking' }).click()
  await expect(page.getByText('Which do you prefer?')).toBeVisible()

  await page.keyboard.press('ArrowLeft')
  await expect(page.getByText(/^1 \/ ~\d+ picks/)).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect(page.getByText(/^0 \/ ~\d+ picks/)).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText(/^1 \/ ~\d+ picks/)).toBeVisible()
  // Progress survives a reload.
  await waitForSave(page)
  await page.reload()
  await expect(page.getByText(/^1 \/ ~\d+ picks/)).toBeVisible()

  let picks = 1
  while (await page.getByText('Which do you prefer?').isVisible()) {
    await page.keyboard.press('ArrowLeft')
    picks++
    await expect(page.getByText(new RegExp(`^${picks} / ~\\d+ picks`)).or(page.getByText('Your ranking'))).toBeVisible()
    expect(picks).toBeLessThan(200)
  }
  await expect(page.getByText(`${fives} films, ranked in ${picks} picks.`)).toBeVisible()
  const order = await page.locator('main ol li button').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  expect(order).toHaveLength(fives)
  expect(order[0]).toMatch(/^1\. /)

  const link = await copyLink(page, page.getByRole('button', { name: 'Share link' }))
  const stranger = await strangerPage(browser)
  await stranger.goto(link)
  await expect(stranger.getByText('My Letterboxd ranking')).toBeVisible()
  await expect(stranger.locator('main ol li button')).toHaveCount(fives)
  expect(await stranger.locator('main ol li button').first().getAttribute('title')).toBe(order[0])
  await stranger.context().close()

  await page.getByRole('button', { name: '→ Send to my tier list' }).click()
  await expect(page.getByText(`Placed ${fives} films on your tier list.`)).toBeVisible()
  // Full mode cuts the ranking into slices: the #1 film opens the top tier.
  expect(await tierCards(page, 0).first().getAttribute('title')).toContain(order[0]!.replace(/^1\. /, ''))

  // A ranking compares too, place by place.
  await page.goto(link)
  await page.getByRole('button', { name: 'With my tier list' }).click()
  await expect(page.getByText(new RegExp(`^agreement on ${fives} films in common`))).toBeVisible()
  await expect(page.locator('main ol li')).toHaveCount(fives)
})
