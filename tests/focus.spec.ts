import type { Page } from "@playwright/test"
import { expect, sectionHref, test, visit, type Mode } from "./sites.ts"

async function outlineOf(page: Page, focus: string, read: string) {
  await page.locator(focus).first().focus()
  return page
    .locator(read)
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        outline: `${style.outlineStyle} ${style.outlineWidth}`,
        color: style.outlineColor,
      }
    })
}

for (const mode of ["light", "dark"] as Mode[]) {
  test(`every interactive surface shows the focus ring (${mode})`, async ({
    page,
    site,
  }) => {
    const listing = sectionHref(site)
    const targets = [
      { url: listing, focus: "[data-bar] nav a" },
      { url: listing, focus: ".theme-flip", read: "[data-theme-toggle]" },
      { url: listing, focus: ".chip" },
      { url: listing, focus: ".card-overlay", read: ".interactive-card" },
      { url: site.typeset[0], focus: "[data-bar] nav ul ul a" },
      ...(site.series
        ? [{ url: site.series, focus: 'nav[aria-label="Chapters"] a' }]
        : []),
      ...(site.theme.features.search
        ? [{ url: "/search/", focus: "#site-search" }]
        : []),
    ]
    for (const { url, focus, read, optional } of targets as {
      url: string
      focus: string
      read?: string
      optional?: boolean
    }[]) {
      await visit(page, site, url, mode)
      if (optional && !(await page.locator(focus).count())) continue
      const { outline, color } = await outlineOf(page, focus, read ?? focus)
      expect(outline, `${focus} on ${url}`).toBe("solid 2px")
      expect(color, `${focus} on ${url}`).not.toMatch(
        /transparent|rgba?\([^)]*,\s*0\)/,
      )
    }
  })
}
