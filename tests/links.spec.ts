import { expect, test } from './sites.ts'

const withoutWww = (hostname: string) => hostname.replace(/^www\./, '')

test('only links that leave the site open in a new tab', async ({
  page,
  site,
}) => {
  const siteHost = withoutWww(new URL(site.theme.site.href).hostname)

  for (const path of ['/', site.footnotes]) {
    await page.goto(path)
    const links = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((anchor) => ({
        href: anchor.getAttribute('href')!,
        target: anchor.getAttribute('target'),
        rel: anchor.getAttribute('rel'),
      })),
    )

    for (const { href, target, rel } of links) {
      const external =
        /^https?:\/\//.test(href) &&
        withoutWww(new URL(href).hostname) !== siteHost
      if (external) {
        expect(target, `${path}: ${href}`).toBe('_blank')
        expect(rel, `${path}: ${href}`).toContain('noopener')
      } else {
        expect(target, `${path}: ${href}`).toBeNull()
      }
    }
  }
})
