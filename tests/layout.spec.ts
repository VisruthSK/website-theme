import { expect, sectionHref, test, visit } from "./sites.ts"

test.describe("layout", () => {
  test("the mobile menu opens and closes", async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await visit(page, site, "/", "light")
    const navigation = page.locator("#site-nav")
    await expect(navigation).toBeHidden()
    await page.locator("[data-menu-button]").click()
    await expect(navigation).toBeVisible()
    await expect(page.locator("[data-menu-button] svg:visible")).toHaveCount(1)
    await expect(
      navigation.getByRole("link", { name: site.theme.sections[0].label }),
    ).toBeVisible()
    await page.locator("[data-menu-button]").click()
    await expect(navigation).toBeHidden()
  })

  test("the mobile header scrolls away", async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await visit(page, site, site.typeset[0], "light")
    await page.evaluate(() => window.scrollTo(0, 700))
    const top = await page
      .locator("aside")
      .evaluate((element) => element.getBoundingClientRect().top)
    expect(top).toBeLessThan(0)
  })

  test("desktop shows the navigation and keeps the toggle at the bottom", async ({
    page,
    site,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    for (const path of ["/", sectionHref(site), site.typeset[0]]) {
      await visit(page, site, path, "light")
      await expect(page.locator("[data-menu-button]")).toBeHidden()
      await expect(page.locator("#site-nav")).toBeVisible()
      const box = (await page.locator("[data-theme-toggle]").boundingBox())!
      expect(box.y + box.height, path).toBeGreaterThan(700)
    }
  })

  test("no page scrolls sideways on a phone", async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    for (const path of ["/", sectionHref(site), site.tag, ...site.typeset]) {
      await visit(page, site, path, "light")
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })

  test("the mobile table of contents opens as a solid list", async ({
    page,
    site,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await visit(page, site, site.typeset[0], "light")
    const list = page.locator("page-toc nav > ul")
    await expect(list).toBeHidden()
    await page.locator("page-toc label").click()
    await expect(list).toBeVisible()
    expect(
      await list.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe("rgba(0, 0, 0, 0)")
  })

  test("a tag page lists Tags once and marks the tag current", async ({
    page,
    site,
  }) => {
    await visit(page, site, site.tag, "light")
    await expect(
      page
        .locator("#site-nav")
        .getByRole("link", { name: "Tags", exact: true }),
    ).toHaveCount(1)
    const tag = decodeURIComponent(site.tag.split("/")[2])
    await expect(
      page.locator("#site-nav a").filter({ hasText: `#${tag}` }),
    ).toHaveAttribute("aria-current", "page")
  })

  test("the wordmark uses the flourish colour", async ({ page, site }) => {
    await visit(page, site, "/", "light")
    const [wordmark, flourish] = await page.evaluate(() => {
      const probe = document.createElement("span")
      probe.style.color = "var(--flourish)"
      document.body.append(probe)
      const colour = getComputedStyle(probe).color
      probe.remove()
      return [
        getComputedStyle(document.querySelector("aside [data-brand]")!).color,
        colour,
      ]
    })
    expect(wordmark).toBe(flourish)
  })

  test("every listing shares one heading style", async ({ page, site }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const styles = new Set<string>()
    for (const path of [
      ...site.theme.sections.map(({ slug }) => `/${slug}/`),
      "/tags/",
      "/recent/",
    ]) {
      await visit(page, site, path, "light")
      styles.add(
        await page
          .locator("page-heading h1")
          .first()
          .evaluate((element) => {
            const { fontSize, fontWeight, fontFamily } =
              getComputedStyle(element)
            return `${fontSize} ${fontWeight} ${fontFamily}`
          }),
      )
    }
    expect([...styles]).toHaveLength(1)
  })

  test("typeset pages paint their first screen already justified", async ({
    page,
    site,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      'only Chromium honours blocking="render" on scripts',
    )
    await page.addInitScript(() => {
      const frames: string[] = []
      ;(window as unknown as { __frames: string[] }).__frames = frames
      const tick = () => {
        frames.push(
          [...document.querySelectorAll("prose-content p, h1")]
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.top < innerHeight && rect.bottom > 0)
            .map((rect) => `${Math.round(rect.top)}/${Math.round(rect.height)}`)
            .join(","),
        )
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await page.goto(site.typeset[0], { waitUntil: "load" })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const layouts = await page.evaluate(
      () =>
        new Set(
          (window as unknown as { __frames: string[] }).__frames.filter(
            Boolean,
          ),
        ).size,
    )
    expect(layouts).toBe(1)
  })
})
