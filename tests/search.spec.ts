import type { Page } from '@playwright/test'
import { enforceCsp, expect, test, type Site } from './sites.ts'

async function search(page: Page, query: string) {
  const input = page.getByRole('searchbox', { name: 'Search the site' })
  await expect(input).toBeVisible()
  await input.fill(query)
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 15_000 })
    .toBe(query)
  await expect(page.locator('[data-search-status]')).toContainText('Showing', {
    timeout: 15_000,
  })
  await expect(page.locator('.search-result__card').first()).toBeVisible()
}

async function open(page: Page, site: Site) {
  await enforceCsp(page, site)
  await page.goto('/search/', { waitUntil: 'domcontentloaded' })
}

test.describe('search', () => {
  test.beforeEach(({ site }) => {
    test.skip(!site.theme.features.search, 'search is switched off')
  })

  test('works under the strict policy and lists every result on one page', async ({
    page,
    site,
  }) => {
    const failures: string[] = []
    page.on('response', (response) => {
      if (response.url().includes('/pagefind/') && response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`)
    })
    page.on('console', (message) => {
      if (/Content Security Policy|WebAssembly|Pagefind/i.test(message.text()))
        failures.push(message.text())
    })
    await open(page, site)
    await search(page, 'everything')
    await expect(page.locator('[data-title] mark').first()).toContainText(
      /everything/i,
    )

    await search(page, 'story')
    const rows = await page.locator('.search-result__card').count()
    expect(rows).toBeGreaterThan(1)
    await expect(page.locator('[data-search-status]')).toHaveText(
      `Showing ${rows} matches.`,
    )
    expect(new URL(page.url()).searchParams.has('page')).toBe(false)
    expect(failures).toEqual([])
  })

  test('a list page returns one result per entry, linked to its permalink', async ({
    page,
    site,
  }) => {
    const { ledger } = site
    test.skip(!ledger, 'the site has no list page')
    await open(page, site)
    await search(page, ledger!.query)
    const links = await page
      .locator('.search-result__card a.card-overlay')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')))
    const entries = links.filter((href) => href?.includes(`${ledger!.path}#`))
    expect(entries).toHaveLength(ledger!.permalinks.length)
    for (const permalink of ledger!.permalinks) {
      expect(entries.some((href) => href?.endsWith(`#${permalink}`))).toBe(true)
    }
  })

  test('pages have no date and cards open their page', async ({
    page,
    site,
  }) => {
    await open(page, site)
    await search(page, 'theme tests run against this site')
    const about = page.locator('.search-result__card').filter({
      has: page.locator('[data-title]', { hasText: 'About' }),
    })
    await expect(about).toHaveCount(1)
    await expect(about.locator('[data-meta]')).toBeHidden()
    await Promise.all([
      page.waitForURL(/\/about\/?$/),
      about.click({ position: { x: 24, y: 24 } }),
    ])
  })
})
