import { expect, test, visit, type Mode } from './sites.ts'

const widths = [390, 1024, 1440]

const name = (path: string) =>
  path
    .replace(/\.html$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'home'

test('pages match their snapshots', async ({ page, site, browserName }) => {
  test.setTimeout(600_000)
  for (const path of site.visual) {
    for (const mode of ['light', 'dark'] as Mode[]) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        await visit(page, site, path, mode)
        await expect
          .soft(page)
          .toHaveScreenshot(`${name(path)}-${mode}-${width}.png`, {
            animations: 'disabled',
            caret: 'hide',
            fullPage: true,
            maxDiffPixelRatio: browserName === 'webkit' ? 0.03 : 0.005,
            timeout: 30_000,
          })
      }
    }
  }
})
