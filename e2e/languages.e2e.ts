import { addTmdbKey, expect, fixtures, importExport, onlyFiveStars, newUser, readClipboard, test, type Page } from './support'

const LANGS = ['en', 'fr', 'zh', 'pt'] as const

// Text that is legitimately the same in every language.
const ALLOWED = [
  /letterboxd2tierlist/i,
  /^(letterboxd|tierlist|2|\.zip)$/,
  /^My Letterboxd (tier list|tournament|ranking)$/, // titles chosen when the link was made
  /^(TMDB|Letterboxd|TierMaker|UwUfufu|GitHub|PNG|ZIP|JSON|VS|WebRTC|Nostr|IndexedDB|vs)$/,
  /^(English|Français|简体中文|Português \(Brasil\))$/,
  /^(Alice|Bob|Alice \(you\)|Bob \(you\))$/,
  /Filler Film|Parasite|Dune|Crouching Tiger|Amélie|Cats|The Room|Heat|Alien|Brazil|Spirited Away|Mission: Impossible|Tenet|Morbius|Barbie|Oppenheimer|Unrated One|Unrated Two|Her|Up|Bob Only|Bob Unrated|Arrival/,
  /^(Sci-fi favourites|Guilty pleasures)/,
  /^(themoviedb\.org\/settings\/api|Settings → Import & Export|Export your data|watched\.csv|ratings\.csv)/,
  /^[a-z2-9]{6}$/,
]

/** Every visible text node and placeholder on the page. */
function texts(page: Page) {
  return page.evaluate(() => {
    const out = new Set<string>()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement
      // Toasts keep the language they were shown in.
      if (!el || el.closest('script,style,option,[role=status]')) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const text = node.textContent?.trim()
      if (text) out.add(text)
    }
    for (const el of document.querySelectorAll('input[placeholder]')) out.add(el.getAttribute('placeholder')!)
    return [...out]
  })
}

async function setLanguage(page: Page, lang: string) {
  await page.locator('header select').selectOption(lang)
  // Other languages are downloaded on first use.
  await expect(page.locator('html')).toHaveAttribute('lang', lang === 'zh' ? 'zh-CN' : lang === 'pt' ? 'pt-BR' : lang)
}

const collected: Record<string, Record<string, string[]>> = {}
async function stage(page: Page, name: string) {
  collected[name] = {}
  for (const lang of LANGS) {
    await setLanguage(page, lang)
    collected[name][lang] = await texts(page)
  }
  await setLanguage(page, 'en')
}

for (const [locale, heading] of [
  ['fr-FR', 'Votre journal Letterboxd, en tier list.'],
  ['zh-CN', '把你的 Letterboxd 观影日记做成梯队榜。'],
  ['pt-BR', 'Seu diário do Letterboxd, em uma tier list.'],
  ['de-DE', 'Your Letterboxd diary, as a tier list.'],
]) {
  test(`a browser in ${locale} opens in the right language`, async ({ browser }) => {
    const { page, errors } = await newUser(browser, { locale })
    await page.goto('/')
    await expect(page.getByText(heading)).toBeVisible()
    expect(errors).toEqual([])
    await page.context().close()
  })
}

test('every screen is fully translated', async ({ page, browser }) => {
  test.setTimeout(300_000)
  await page.goto('/')
  await expect(page.getByText('Drop your Letterboxd export ZIP here')).toBeVisible()
  await stage(page, 'import')
  await importExport(page, await fixtures.alice())
  await expect(page.getByText('80 films', { exact: true })).toBeVisible()
  await stage(page, 'board-no-key')
  await page.getByRole('button', { name: 'Add TMDB key' }).click()
  await stage(page, 'settings')
  await page.getByRole('button', { name: 'Close' }).click()
  await addTmdbKey(page)
  await page.getByRole('button', { name: '★ Auto-fill by rating' }).click()
  await stage(page, 'autofill-dialog')
  await page.getByRole('button', { name: /Apply to/ }).click()
  await page.getByRole('button', { name: /^Horror/ }).click()
  await page.getByLabel('People').click()
  await stage(page, 'board')
  await page.getByRole('button', { name: 'Any', exact: true }).click()
  await page.locator('[data-tier] .flex-1 [title]').first().click()
  await stage(page, 'tap-to-place')
  await page.getByRole('toolbar').getByRole('button', { name: 'Details' }).click()
  await page.getByPlaceholder('Title, TMDB id or TMDB URL').fill('Alien')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByTitle('Use this film').first().waitFor()
  await stage(page, 'film-dialog')
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Export' }).click()
  await stage(page, 'export-dialog')
  await page.getByRole('button', { name: /Copy share link/ }).click()
  const listLink = await readClipboard(page)
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/#/tournament')
  await stage(page, 'tournament-setup')
  await page.locator('main label', { hasText: 'Bracket size' }).locator('select').selectOption('8')
  await page.getByRole('button', { name: 'Start tournament' }).click()
  await page.keyboard.press('ArrowLeft')
  await stage(page, 'tournament-match')
  for (let i = 1; i < 7; i++) {
    await expect(page.getByText(`${i} / 7 matches played`)).toBeVisible()
    await page.keyboard.press('ArrowLeft')
  }
  await page.getByText('Full bracket').click()
  await stage(page, 'tournament-results')
  await page.getByRole('button', { name: 'Share link' }).click()
  const tournamentLink = await readClipboard(page)

  await page.goto('/')
  await onlyFiveStars(page)
  await page.goto('/#/rank')
  await stage(page, 'rank-setup')
  await page.getByText('Full ranking').click()
  await page.getByRole('button', { name: 'Start ranking' }).click()
  await stage(page, 'rank-picking')
  while (await page.getByText('Which do you prefer?').isVisible()) {
    const before = await page.getByText(/ picks · /).innerText()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByText(before)).toHaveCount(0)
  }
  await stage(page, 'rank-results')
  await page.getByRole('button', { name: 'Share link' }).click()
  const rankingLink = await readClipboard(page)

  for (const [name, link] of [
    ['shared-list', listLink],
    ['shared-tournament', tournamentLink],
    ['shared-ranking', rankingLink],
  ]) {
    await page.goto(link)
    await expect(page.getByText(/^My Letterboxd/)).toBeVisible()
    await stage(page, name)
  }
  await page.goto(listLink)
  await page.getByRole('button', { name: 'With my tier list' }).click()
  await expect(page.getByText(/^\d+%$/)).toBeVisible()
  await stage(page, 'compare')

  // ---- rooms
  const alice = await newUser(browser)
  const bob = await newUser(browser)
  await alice.page.goto('/#/rooms')
  await alice.page.getByPlaceholder('How friends will see you').fill('Alice')
  await stage(alice.page, 'lobby')
  await alice.page.getByRole('button', { name: 'Create room' }).click()
  await alice.page.getByText('Copy invite link').waitFor()
  const roomId = alice.page.url().split('/room/')[1]
  await importExport(alice.page, await fixtures.alice())
  await bob.page.goto(`/#/room/${roomId}`)
  await bob.page.getByPlaceholder('How friends will see you').fill('Bob')
  await bob.page.getByRole('button', { name: 'Join' }).click()
  await expect(bob.page.getByText('2 people online')).toBeVisible({ timeout: 90_000 })
  await importExport(bob.page, await fixtures.bob())
  await expect(alice.page.getByText('15 films')).toBeVisible({ timeout: 15_000 })
  await stage(alice.page, 'room-board')

  await alice.page.getByRole('tab', { name: /Showdown/ }).click()
  await stage(alice.page, 'showdown-setup')
  await alice.page.locator('label', { hasText: 'Mode' }).locator('select').selectOption('guess')
  await alice.page.locator('label', { hasText: 'Number of films' }).locator('select').selectOption('10')
  await alice.page.getByRole('button', { name: 'Start showdown' }).click()
  await expect(bob.page.getByText(/Rank these \d+ films/)).toBeVisible({ timeout: 10_000 })
  await stage(bob.page, 'showdown-ranking')
  for (const { page: p } of [alice, bob]) {
    await p.getByRole('button', { name: '★ Auto-fill by rating' }).click()
    await p.getByRole('button', { name: 'Lock in my list' }).click()
    await p.getByText('✓ Locked in. Waiting for the reveal.').waitFor()
  }
  await stage(bob.page, 'showdown-locked')
  await alice.page.getByRole('button', { name: 'Reveal lists (2)' }).click()
  await expect(bob.page.getByText('The lists are in!')).toBeVisible({ timeout: 10_000 })
  for (const { page: p } of [alice, bob]) {
    await p.locator('main select').last().selectOption({ index: 1 })
    await p.getByRole('button', { name: '👑 Best' }).first().click()
  }
  await stage(bob.page, 'showdown-reveal')
  await alice.page.getByRole('button', { name: 'Show results' }).click()
  await expect(bob.page.getByText('🕵️ Best detectives')).toBeVisible({ timeout: 10_000 })
  await stage(bob.page, 'showdown-results')

  await alice.page.getByRole('tab', { name: 'Tournament' }).click()
  await stage(alice.page, 'group-tournament-setup')
  await alice.page.locator('label', { hasText: 'Bracket size' }).locator('select').selectOption({ index: 0 })
  await alice.page.getByRole('button', { name: 'Start group tournament' }).click()
  await expect(bob.page.getByText(/Match 1 of/)).toBeVisible({ timeout: 10_000 })
  for (const { page: p } of [alice, bob]) await p.locator('main button:has-text("seed")').first().click()
  await expect(bob.page.getByText('Last match:')).toBeVisible({ timeout: 10_000 })
  await stage(bob.page, 'group-tournament-voting')
  await stage(alice.page, 'group-tournament-voting-host')

  // ---- compare languages: Chinese shares no words with English, so any English text left in the
  // Chinese page is an untranslated string.
  const leftovers: Record<string, string[]> = {}
  for (const [name, byLang] of Object.entries(collected)) {
    const zh = new Set(byLang.zh)
    const same = byLang.en.filter((t) => zh.has(t) && /[A-Za-z]{3,}/.test(t) && !ALLOWED.some((re) => re.test(t)))
    if (same.length) leftovers[name] = same
  }
  expect(leftovers).toEqual({})
  expect(Object.keys(collected).length).toBeGreaterThanOrEqual(28)
  expect([...alice.errors, ...bob.errors]).toEqual([])
  await alice.page.context().close()
  await bob.page.context().close()
})
