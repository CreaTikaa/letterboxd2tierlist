import { addTmdbKey, copyLink, expect, fixtures, importExport, strangerPage, test } from './support'

test('share a tier list, open it elsewhere, compare two lists', async ({ page, browser }) => {
  await page.goto('/')
  await importExport(page, await fixtures.alice())
  await addTmdbKey(page)
  await page.getByRole('button', { name: '★ Auto-fill by rating' }).click()
  await page.getByRole('button', { name: /Apply to 80 visible films/ }).click()

  await page.getByRole('button', { name: 'Export' }).click()
  const mine = await copyLink(page, page.getByRole('button', { name: /Copy share link/ }))
  await expect(page.getByText(/Link copied/)).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  const placed = await page.locator('[data-tier] .flex-1 [title]').count()

  // A friend opens it with nothing imported and no TMDB key.
  const friend = await strangerPage(browser)
  await friend.goto(mine)
  await expect(friend.getByText('My Letterboxd tier list')).toBeVisible()
  await expect(friend.locator('main [title]')).toHaveCount(placed)
  // No board of their own yet: only "paste another link" is offered.
  await expect(friend.getByRole('button', { name: 'With my tier list' })).toHaveCount(0)

  // Change the list (Cats to S) and share again, then compare both links.
  const cats = page.locator('[data-tier] .flex-1 [title^="Cats"]')
  await cats.click()
  await page.getByRole('toolbar').getByRole('button', { name: 'S', exact: true }).click()
  await expect(page.locator('[data-tier]').first().locator('[title^="Cats"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Export' }).click()
  const changed = await copyLink(page, page.getByRole('button', { name: /Copy share link/ }))
  await page.getByRole('button', { name: 'Close' }).click()

  await friend.getByPlaceholder('…or paste another share link').fill(changed)
  await friend.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(friend).toHaveURL(/#\/compare\//)
  await expect(friend.getByText(/^\d+%$/)).toBeVisible()
  const agreement = Number((await friend.getByText(/^\d+%$/).innerText()).replace('%', ''))
  expect(agreement).toBeGreaterThan(90)
  expect(agreement).toBeLessThan(100)
  await expect(friend.getByText('Biggest disagreements')).toBeVisible()
  await expect(friend.locator('li', { hasText: 'Cats' })).toBeVisible()

  // The owner can compare a shared link with their own board.
  await page.goto(mine)
  await page.getByRole('button', { name: 'With my tier list' }).click()
  await expect(page).toHaveURL(/#\/compare\/[^/]+\/mine$/)
  await expect(page.getByText('My tier list').first()).toBeVisible()
  await expect(page.locator('li', { hasText: 'Cats' })).toBeVisible()

  // Broken links show an error, not a crash.
  await friend.goto('/#/view/garbage-garbage')
  await expect(friend.getByText('This link is broken or incomplete.')).toBeVisible()
  await friend.context().close()
})
