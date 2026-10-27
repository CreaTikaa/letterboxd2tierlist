import { addTmdbKey, drag, expect, fixtures, importExport, newUser, readClipboard, test, type Page, type User } from './support'

// Rooms connect real browsers peer-to-peer through public relays: allow time to find each other.
const CONNECT = { timeout: 90_000 }
const SYNC = { timeout: 15_000 }
test.describe.configure({ timeout: 300_000 })

const users: User[] = []
test.afterEach(async () => {
  const errors = users.flatMap((u) => u.errors)
  for (const user of users.splice(0)) await user.page.context().close()
  expect(errors).toEqual([])
})

async function person(browser: import('@playwright/test').Browser) {
  const user = await newUser(browser)
  users.push(user)
  return user.page
}

async function createRoom(page: Page, name: string, password = '') {
  await page.goto('/#/rooms')
  await page.getByPlaceholder('How friends will see you').fill(name)
  if (password) await page.getByPlaceholder('Password (optional)').fill(password)
  await page.getByRole('button', { name: 'Create room' }).click()
  await expect(page.getByText('Copy invite link')).toBeVisible()
  return page.url().split('/room/')[1]
}

async function join(page: Page, name: string, roomId: string) {
  await page.goto(`/#/room/${roomId}`)
  await page.getByPlaceholder('How friends will see you').fill(name)
  await page.getByRole('button', { name: 'Join' }).click()
}

async function share(page: Page, file: string, count: number) {
  await importExport(page, file)
  await expect(page.getByText(`You're sharing ${count} films.`)).toBeVisible()
}

const tierCount = (page: Page, index: number) => page.locator('[data-tier]').nth(index).locator('.flex-1 [title]')

test('shared board and showdown between two people, then host hand-over', async ({ browser }) => {
  const alice = await person(browser)
  const bob = await person(browser)
  const roomId = await createRoom(alice, 'Alice')
  await share(alice, await fixtures.alice(), 80)

  await join(bob, 'Bob', roomId)
  await expect(bob.getByText('2 people online')).toBeVisible(CONNECT)
  await expect(bob.getByText('80 films').first()).toBeVisible(SYNC)
  await expect(bob.locator('div.rounded-full', { hasText: 'Alice' }).getByText('host')).toHaveCount(1)

  await share(bob, await fixtures.bob(), 15)
  await expect(alice.getByText('15 films')).toBeVisible(SYNC)
  await expect(alice.getByText(/^Showing/)).toContainText('of 83')

  // Only Alice has a TMDB key; Bob gets the posters through the room.
  await addTmdbKey(alice)
  await expect.poll(() => bob.locator('main img').count(), SYNC).toBeGreaterThan(50)

  await bob.locator('main select').filter({ hasText: 'everyone' }).selectOption('2')
  await expect(bob.getByText(/^Showing/)).toContainText('Showing 12 of 12')

  await alice.locator('main select').filter({ hasText: 'everyone' }).selectOption('2')
  await alice.getByRole('button', { name: '★ Auto-fill by rating' }).click()
  await alice.getByRole('button', { name: /Apply to 12 visible films/ }).click()
  const aliceS = await tierCount(alice, 0).count()
  await expect(tierCount(bob, 0)).toHaveCount(aliceS, SYNC)
  await expect(bob.getByText('5.0★ · 2👤').first()).toBeVisible()

  // Bob drags a film to F; Alice sees it. Then Bob taps one to B, and undoes it.
  const fBefore = await tierCount(alice, 5).count()
  const card = (await tierCount(bob, 0).first().boundingBox())!
  const target = (await bob.locator('[data-tier]').nth(5).locator('.flex-1').boundingBox())!
  await drag(bob, { x: card.x + card.width / 2, y: card.y + card.height / 2 }, { x: target.x + target.width - 80, y: target.y + target.height / 2 })
  await expect(tierCount(alice, 5)).toHaveCount(fBefore + 1, SYNC)

  const bBefore = await tierCount(alice, 2).count()
  // Right after a drag, dnd-kit swallows one click (so the drop doesn't count as a tap): retry.
  await expect(async () => {
    await tierCount(bob, 5).first().click()
    await expect(bob.locator('[data-selected]')).toHaveCount(1, { timeout: 1000 })
  }).toPass()
  await bob.keyboard.press('3')
  await expect(tierCount(alice, 2)).toHaveCount(bBefore + 1, SYNC)
  await bob.keyboard.press('Escape')
  await bob.keyboard.press('Control+z')
  await expect(tierCount(alice, 2)).toHaveCount(bBefore, SYNC)

  // Showdown: both rank privately, lock in, reveal, vote.
  await alice.getByRole('tab', { name: /Showdown/ }).click()
  await alice.getByRole('button', { name: 'Start showdown' }).click()
  await expect(bob.getByText(/Rank these \d+ films/)).toBeVisible(SYNC)
  for (const page of [alice, bob]) {
    await page.getByRole('button', { name: '★ Auto-fill by rating' }).click()
    await page.getByRole('button', { name: 'Lock in my list' }).click()
    await expect(page.getByText('✓ Locked in. Waiting for the reveal.')).toBeVisible()
  }
  await alice.getByRole('button', { name: 'Reveal lists (2)' }).click(SYNC)
  await expect(bob.getByText('The lists are in!')).toBeVisible(SYNC)
  await alice.getByRole('button', { name: '👑 Best' }).click()
  await bob.getByRole('button', { name: '💀 Worst' }).click()
  await expect(alice.getByText('2 of 2 voted')).toBeVisible(SYNC)
  await alice.getByRole('button', { name: 'Show results' }).click()
  await expect(bob.getByText('👑 Best list')).toBeVisible(SYNC)
  await expect(bob.getByText('👑 Best list').locator('xpath=following-sibling::p[1]')).toHaveText('Bob')
  await expect(bob.getByText('💀 Worst list').locator('xpath=following-sibling::p[1]')).toHaveText('Alice')

  // Alice leaves: Bob takes over as host and keeps the room after a reload.
  await alice.context().close()
  await expect(bob.getByText('Waiting for friends')).toBeVisible({ timeout: 45_000 })
  await expect(bob.locator('div.rounded-full', { hasText: 'Bob' }).getByText('host')).toHaveCount(1)
  await bob.getByRole('button', { name: 'New showdown' }).click()
  await expect(bob.getByRole('button', { name: 'Start showdown' })).toBeVisible()
  await bob.reload()
  await expect(bob.getByText(/^Showing/)).toContainText('of 83', { timeout: 20_000 })
})

test('password, guess whose list, and a group tournament for three', async ({ browser }) => {
  const alice = await person(browser)
  const bob = await person(browser)
  const carol = await person(browser)
  const everyone = [alice, bob, carol]

  const roomId = await createRoom(alice, 'Alice', 'hunter2')
  await expect(alice.getByRole('button', { name: '🔒 Password' })).toBeVisible()
  await share(alice, await fixtures.alice(), 80)

  // Without the password, Bob is asked for it.
  await join(bob, 'Bob', roomId)
  await expect(bob.getByText(/This room has a password\. Enter it to join:|it probably has a password/)).toBeVisible(CONNECT)
  await expect(bob.getByText('2 people online')).toHaveCount(0)
  if (!(await bob.getByPlaceholder('Room password').isVisible())) await bob.getByRole('button', { name: 'enter it' }).click()
  await bob.getByPlaceholder('Room password').fill('hunter2')
  await bob.getByRole('button', { name: 'Use password' }).click()
  await expect(bob.getByText('2 people online')).toBeVisible(CONNECT)

  // "Copy link + password" lets Carol straight in, and the password leaves the address bar.
  await alice.getByRole('button', { name: 'Copy link + password' }).click()
  const link = await readClipboard(alice)
  expect(link).toContain('?pw=hunter2')
  await carol.goto(link)
  await carol.getByPlaceholder('How friends will see you').fill('Carol')
  await carol.getByRole('button', { name: 'Join' }).click()
  await expect(carol.getByText('3 people online')).toBeVisible(CONNECT)
  expect(carol.url()).not.toContain('pw=')

  await share(bob, await fixtures.bob(), 15)
  await share(carol, await fixtures.carol(), 9)
  await expect(alice.getByText('9 films')).toBeVisible(SYNC)

  // ---- Guess whose list
  await alice.getByRole('tab', { name: /Showdown/ }).click()
  await alice.locator('label', { hasText: 'Mode' }).locator('select').selectOption('guess')
  await alice.locator('label', { hasText: 'Number of films' }).locator('select').selectOption('10')
  await alice.getByRole('button', { name: 'Start showdown' }).click()
  for (const page of everyone) {
    await expect(page.getByText(/Rank these \d+ films/)).toBeVisible(SYNC)
    await page.getByRole('button', { name: '★ Auto-fill by rating' }).click()
    await page.getByRole('button', { name: 'Lock in my list' }).click()
    await expect(page.getByText('✓ Locked in. Waiting for the reveal.')).toBeVisible()
  }
  await alice.getByRole('button', { name: 'Reveal lists (3)' }).click(SYNC)
  await expect(bob.getByText('Guess who made each list')).toBeVisible(SYNC)
  const labels = await Promise.all(everyone.map((p) => p.locator('main .grid > div').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.split('\n')[0]))))
  for (const label of labels[0]) expect(label).toMatch(/^List [ABC]/)
  const strip = (list: string[]) => list.map((l) => l.replace(' (yours)', ''))
  expect(strip(labels[1])).toEqual(strip(labels[0]))
  expect(labels[1].join(' ')).not.toMatch(/Alice|Carol/)

  for (const page of everyone) {
    const selects = page.locator('main select')
    const count = await selects.count()
    for (let i = 0; i < count; i++) await selects.nth(i).selectOption({ index: 1 + (i % 2) })
    await page.getByRole('button', { name: '👑 Best' }).first().click()
  }
  await expect(alice.getByText('3 of 3 voted · 3 finished guessing')).toBeVisible(SYNC)
  await alice.getByRole('button', { name: 'Show results' }).click()
  await expect(carol.getByText('🕵️ Best detectives')).toBeVisible(SYNC)
  await expect(carol.getByText(/^List [ABC] was$/)).toHaveCount(3)

  // ---- Group tournament on the films everyone saw, seeded by median rating
  await alice.getByRole('tab', { name: 'Tournament' }).click()
  await expect(alice.locator('main select').first().locator('option:checked')).toHaveText(/Everyone \(3\)/)
  await expect(alice.getByText(/^8 films · 7 matches/)).toBeVisible()
  const top2 = await alice.locator('[title^="#1 ·"], [title^="#2 ·"]').evaluateAll((els) => els.map((e) => e.getAttribute('title')!))
  for (const title of top2) expect(title).toMatch(/(Alien|Spirited Away).*★★★★★/)
  await alice.getByRole('button', { name: 'Start group tournament' }).click()
  for (const page of everyone) await expect(page.getByText('Quarter-finals')).toBeVisible(SYNC)

  const vote = (page: Page, side: number) => page.locator('main button:has-text("seed")').nth(side).click()
  const played = (n: number) => expect(alice.getByText(`${n} / 7 matches played`)).toBeVisible(SYNC)

  // A match resolves once everyone voted (2–1).
  await vote(alice, 1)
  await vote(bob, 1)
  await expect(alice.getByText('Close vote (2/3)')).toBeVisible(SYNC)
  await played(0)
  await vote(carol, 0)
  await played(1)
  await expect(carol.getByText('Last match:').locator('xpath=..')).toContainText('2–1')

  // The host can close a vote early, and undo it.
  await vote(bob, 0)
  await alice.getByRole('button', { name: 'Close vote (1/3)' }).click()
  await played(2)
  await alice.getByRole('button', { name: '↶ Undo last match' }).click()
  await expect(bob.getByText('1 / 7 matches played')).toBeVisible(SYNC)

  for (let i = 1; i < 7; i++) {
    await vote(alice, 0)
    await vote(bob, 0)
    await vote(carol, 1)
    if (i < 6) await played(i + 1)
  }
  for (const page of everyone) await expect(page.getByText('🏆 Champion').first()).toBeVisible(SYNC)
  const champions = await Promise.all(everyone.map((p) => p.locator('main h1').last().innerText()))
  expect(new Set(champions).size).toBe(1)
  await expect(bob.locator('details[open] p')).toHaveCount(7)
  await expect(bob.getByRole('button', { name: 'New tournament' })).toHaveCount(0)

  // Anyone can share the result.
  await bob.getByRole('button', { name: 'Share link' }).click()
  expect(await readClipboard(bob)).toMatch(/#\/view\//)
})
