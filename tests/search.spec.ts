import type { Page } from "@playwright/test"
import { enforceCsp, expect, test, type Site } from "./sites.ts"

const results = (page: Page) =>
  page.getByRole("list", { name: "Search results" }).getByRole("listitem")

async function search(page: Page, query: string) {
  const input = page.getByRole("searchbox", { name: "Search the site" })
  await expect(input).toBeVisible()
  await input.fill(query)
  await expect
    .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 15_000 })
    .toBe(query)
  await expect(page.getByRole("status")).toContainText("Showing", {
    timeout: 15_000,
  })
  await expect(results(page).first()).toBeVisible()
}

async function open(page: Page, site: Site) {
  await enforceCsp(page, site)
  await page.goto("/search/", { waitUntil: "domcontentloaded" })
}

test.describe("search", () => {
  test.beforeEach(({ site }) => {
    test.skip(!site.theme.features.search, "search is switched off")
  })

  test("works under the strict policy and lists every result on one page", async ({
    page,
    site,
  }) => {
    const failures: string[] = []
    page.on("response", (response) => {
      if (response.url().includes("/pagefind/") && response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`)
    })
    page.on("console", (message) => {
      if (/Content Security Policy|WebAssembly|Pagefind/i.test(message.text()))
        failures.push(message.text())
    })
    await open(page, site)
    await search(page, "everything")
    await expect(
      results(page).getByRole("heading").locator("mark").first(),
    ).toContainText(/everything/i)

    await search(page, "story")
    const rows = await results(page).count()
    expect(rows).toBeGreaterThan(1)
    await expect(page.getByRole("status")).toHaveText(
      `Showing ${rows} matches.`,
    )
    expect(new URL(page.url()).searchParams.has("page")).toBe(false)
    expect(failures).toEqual([])
  })

  test("a list page returns one result per entry, linked to its permalink", async ({
    page,
    site,
  }) => {
    const { ledger } = site
    test.skip(!ledger, "the site has no list page")
    await open(page, site)
    await search(page, ledger!.query)
    const links = await results(page)
      .locator("a.card-overlay")
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href")))
    const entries = links.filter((href) => href?.includes(`${ledger!.path}#`))
    expect(entries).toHaveLength(ledger!.permalinks.length)
    for (const permalink of ledger!.permalinks) {
      expect(entries.some((href) => href?.endsWith(`#${permalink}`))).toBe(true)
    }
  })

  test("pages have no date and cards open their page", async ({
    page,
    site,
  }) => {
    await open(page, site)
    await search(page, "theme tests run against this site")
    const about = results(page).filter({
      has: page.getByRole("heading", { name: "About" }),
    })
    await expect(about).toHaveCount(1)
    await expect(about.locator(".meta-row")).toBeHidden()
    await Promise.all([
      page.waitForURL(/\/about\/?$/),
      about.click({ position: { x: 24, y: 24 } }),
    ])
  })
})
