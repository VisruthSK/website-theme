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

  test('works under the strict policy and pages through results', async ({
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
    await search(page, 'margin')
    await expect(page.locator('[data-title] mark').first()).toContainText(
      /margin/i,
    )

    await search(page, 'the')
    const first = page.locator('[data-title]').first()
    const before = await first.textContent()
    await page.getByRole('button', { name: 'Go to page 2' }).click()
    await expect(page).toHaveURL(/[?&]page=2\b/)
    await expect(first).not.toHaveText(before ?? '')
    expect(failures).toEqual([])
  })

  test('pages have no date and cards open their page', async ({
    page,
    site,
  }) => {
    await open(page, site)
    await search(page, 'placeholder text written for testing')
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
