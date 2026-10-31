import { baseOf, expect, test } from './sites.ts'

test.describe('list page', () => {
  test.beforeEach(({ site }) => {
    test.skip(!site.ledger, 'the site has no list page')
  })

  test('groups entries by year and handles the rare cases', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const years = await page.locator('h2[data-year]').allTextContents()
    expect(years).toEqual(['2026', '2025', 'Undated'])

    const ids = await page
      .locator('.interactive-card .card-title')
      .evaluateAll((titles) => titles.map((title) => title.id))
    expect(ids).toEqual([
      'the-gift-of-the-magi-01',
      'the-selfish-giant-02',
      'moby-dick-01',
      'the-selfish-giant-01',
      'walden-01',
      'dracula-01',
    ])

    await expect(page.locator('main')).not.toContainText('/10')
    await expect(page.locator('.dnf')).toHaveText('DNF')
    await expect(page.locator('.chip')).toHaveCount(1)
    await expect(page.locator('.score').first()).toHaveText('9')
  })

  test('shows full dates and prints loose dates as written', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const card = (title: string) =>
      page.locator('.interactive-card', { hasText: title }).first()
    await expect(card('The Gift of the Magi')).toContainText(
      '1 October 2026 – 14 October 2026',
    )
    await expect(card('The Gift of the Magi')).toContainText('1905')
    await expect(card('Moby-Dick')).toContainText('18 October 1851')
    await expect(card('Walden')).toContainText('2 March 2025 – 20 March 2025')
    await expect(card('Dracula')).not.toContainText('–')
    await expect(
      page.locator('.interactive-card', { hasText: 'May 1888' }),
    ).toHaveCount(2)
  })

  test('a link opens in the same tab and a card links to itself', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const link = page.getByRole('link', { name: 'Essay' }).first()
    expect(await link.getAttribute('target')).toBeNull()
    expect(await link.getAttribute('href')).toBe(
      `${baseOf(site)}/essays/the-gift-of-the-magi/`,
    )

    await page
      .locator('.interactive-card', { hasText: 'Moby-Dick' })
      .click({ position: { x: 24, y: 24 } })
    await expect(page).toHaveURL(/#moby-dick-01$/)
  })
})

test('collections and Recent group entries under year headings, unpaginated', async ({
  page,
  site,
}) => {
  for (const path of ['/recent/', `/${site.theme.sections[0].slug}/`]) {
    await page.goto(path)
    expect(await page.locator('h2[data-year]').count(), path).toBeGreaterThan(0)
    await expect(page.locator('.pagination-nav'), path).toHaveCount(0)
  }
})
