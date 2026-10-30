import { expect, test, visit } from './sites.ts'

test('a resource page lists the files in its public folder', async ({
  page,
  site,
}) => {
  test.skip(!site.theme.resources.length, 'no resources are configured')
  for (const { slug, label } of site.theme.resources) {
    await visit(page, site, `/${slug}/`, 'light')
    await expect(page.locator('h1')).toHaveText(label)
    const links = page.locator('[data-entries] .card-overlay')
    expect(await links.count()).toBeGreaterThan(1)
    for (const link of await links.all()) {
      const href = (await link.getAttribute('href'))!
      expect(href).toContain(`/${slug}/`)
      expect((await page.request.get(href)).ok(), href).toBe(true)
    }
  }
})

test('the home page uses the introduction page when there is one', async ({
  page,
  site,
}) => {
  test.skip(
    site.name !== 'example',
    'only the full example has an introduction',
  )
  await visit(page, site, '/', 'light')
  const card = page.locator('hero-card')
  await expect(card.locator('h1')).toHaveText(site.theme.site.title)
  await expect(card).toContainText('Everything above the rule')
  expect(await card.locator('hr ~ *').count()).toBeGreaterThan(1)
  expect((await page.request.get('/home/')).status()).toBe(404)
})
