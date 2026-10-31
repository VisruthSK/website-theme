import { expect, sectionHref, test, isolatedPage } from "./sites.ts"

const modes = ["light", "dark"] as const

test("the toggle switches modes and the choice persists", async ({
  page,
  site,
}) => {
  await page.goto("/")
  const html = page.locator("html")
  await expect(html).not.toHaveAttribute("data-theme")
  await page.locator("[data-theme-toggle]").click()
  await expect(html).toHaveAttribute("data-theme", "dark")
  await page.goto(sectionHref(site))
  await expect(html).toHaveAttribute("data-theme", "dark")
  await page.locator("[data-theme-toggle]").click()
  await expect(html).toHaveAttribute("data-theme", "light")
})

for (const stored of modes) {
  const system = stored === "dark" ? "light" : "dark"

  test(`a stored ${stored} preference beats a ${system} system`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: system })
    await page.addInitScript((mode) => {
      window.localStorage.setItem("theme", mode)
    }, stored)
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("data-theme", stored)
  })

  test(`the canvas is ${stored} before the stylesheet on a ${system} system`, async ({
    page,
    site,
  }) => {
    await page.emulateMedia({ colorScheme: system })
    await page.addInitScript((mode) => {
      window.localStorage.setItem("theme", mode)
    }, stored)
    await page.route("**/*.css", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await page.goto(sectionHref(site), { waitUntil: "commit" })
    await page.waitForFunction(
      () => document.documentElement.dataset.theme,
      undefined,
      { polling: 20 },
    )
    const state = await page.evaluate(() => ({
      loaded: [...document.querySelectorAll('link[rel="stylesheet"]')].filter(
        (link) => (link as HTMLLinkElement).sheet,
      ).length,
      scheme: document
        .querySelector('meta[name="color-scheme"]')
        ?.getAttribute("content"),
    }))
    expect(state.loaded).toBe(0)
    expect(state.scheme).toBe(stored)
  })

  test(`the toggle works without JavaScript on a ${stored} system`, async ({
    browser,
    site,
  }) => {
    const { context, page } = await isolatedPage(browser, site, {
      javaScriptEnabled: false,
      colorScheme: stored,
    })
    await page.goto("/")
    const background = () =>
      page
        .locator("html")
        .evaluate((html) => getComputedStyle(html).backgroundColor)
    const before = await background()
    await page.locator("[data-theme-toggle]").click()
    expect(await background()).not.toBe(before)
    await context.close()
  })
}

test("with nothing stored the page follows the system", async ({ page }) => {
  const background = () =>
    page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    )
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  const dark = await background()
  await page.emulateMedia({ colorScheme: "light" })
  expect(await background()).not.toBe(dark)
})
