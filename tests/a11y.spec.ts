import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, visit, type Mode } from './sites.ts'

for (const mode of ['light', 'dark'] as Mode[]) {
  test(`every page passes axe (${mode})`, async ({ page, site }) => {
    test.setTimeout(300_000)
    const sitemap = readFileSync(
      join(process.cwd(), site.dir, 'dist', 'sitemap-0.xml'),
      'utf8',
    )
    const paths = [
      ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        ([, loc]) => new URL(loc).pathname,
      ),
      '/404.html',
    ]
    expect(paths.length).toBeGreaterThan(5)
    for (const path of paths) {
      await visit(page, site, path, mode)
      const { violations } = await new AxeBuilder({ page }).analyze()
      expect(
        violations.map(({ id, nodes }) => `${path} ${id} (${nodes.length})`),
      ).toEqual([])
    }
  })
}
