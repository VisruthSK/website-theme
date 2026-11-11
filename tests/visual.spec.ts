import { expect, SITES, test, visit, type Mode } from "./sites.ts"

const widths = [390, 1024, 1440]

const name = (path: string) =>
  path
    .replace(/\.html$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "home"

for (const [siteName, { visual }] of Object.entries(SITES)) {
  for (const path of visual) {
    test(`${siteName} visual: ${path} matches its snapshots`, async ({
      page,
      site,
      browserName,
    }) => {
      test.setTimeout(180_000)
      for (const mode of ["light", "dark"] as Mode[]) {
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 })
          await visit(page, site, path, mode)
          await expect
            .soft(page)
            .toHaveScreenshot(`${name(path)}-${mode}-${width}.png`, {
              animations: "disabled",
              caret: "hide",
              fullPage: true,
              maxDiffPixelRatio: browserName === "webkit" ? 0.03 : 0.005,
              timeout: 30_000,
            })
        }
      }
    })
  }
}
