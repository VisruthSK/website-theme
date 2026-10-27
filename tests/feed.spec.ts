import { expect, test } from './sites.ts'

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
    const response = await request.get(path)
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
