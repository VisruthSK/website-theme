import { baseOf, expect, test } from './sites.ts'

test('every feed is valid and points at the configured host', async ({
  request,
  site,
}) => {
  const paths = [
    '/rss.xml',
    '/index.xml',
    ...site.theme.sections.map(({ slug }) => `/${slug}/rss.xml`),
    `${site.tag}rss.xml`,
  ]
  for (const path of paths) {
    const response = await request.get(`${baseOf(site)}${path}`)
    expect(response.ok(), path).toBeTruthy()
    expect(response.headers()['content-type']).toContain('xml')
    const body = await response.text()
    expect(body).toContain('<rss')
    expect(body).toContain('<item>')
    expect(body).toContain(`<link>${site.theme.site.href}`)
    expect(body).not.toContain('<script')
    expect(body).not.toContain('<style')
    expect(body).not.toContain('<svg')
    expect(body).not.toContain('data-astro-')
  }
})

test('a post with rss: false is left out of every feed and still has its page', async ({
  request,
  site,
}) => {
  const { unfeeded } = site
  test.skip(!unfeeded, 'the site has no post with rss: false')
  const base = baseOf(site)
  const origin = new URL(site.theme.site.href).origin
  const paths = [
    '/rss.xml',
    '/index.xml',
    ...site.theme.sections.map(({ slug }) => `/${slug}/rss.xml`),
    `${site.tag}rss.xml`,
  ]
  for (const path of paths) {
    const body = await (await request.get(`${base}${path}`)).text()
    expect(body, path).not.toContain(
      `<link>${origin}${base}${unfeeded!}</link>`,
    )
  }
  const page = await request.get(`${base}${unfeeded!}`)
  expect(page.ok()).toBeTruthy()
})
