import { readFile } from "node:fs/promises"
import { expect, sectionHref, test, visit, type Site } from "./sites.ts"

const OUTSIDE_EVERY_FACE = "漢"

const families = (site: Site) => {
  const { body, heading, mono } = site.theme.fonts
  return [body, heading, ...(mono ? [mono] : [])].map((family) => ({
    family: family.family,
    source: `${site.dir}/${site.theme.fonts.directory}/${family.faces[0].file}`,
  }))
}

test("the configured faces are applied", async ({ page, site }) => {
  await visit(page, site, site.typeset[0], "light")
  const applied = await page.evaluate(() => {
    const used = (selector: string) => {
      const element = document.querySelector(selector)
      return element
        ? getComputedStyle(element)
            .fontFamily.split(",")[0]
            .trim()
            .replace(/^["']|["']$/g, "")
        : "MISSING"
    }
    return {
      heading: used("h1"),
      body: used("prose-content p"),
      wordmark: used("[data-bar] [data-brand] span"),
    }
  })
  const { body, heading } = site.theme.fonts
  expect(applied).toEqual({
    heading: heading.family,
    body: body.family,
    wordmark: body.family,
  })
  if (site.code) {
    await visit(page, site, site.code, "light")
    const code = await page
      .locator("prose-content :not(pre) > code")
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily)
    expect(code).toContain(site.theme.fonts.mono!.family)
  }
})

test("subsetting drops no glyph a page renders", async ({ page, site }) => {
  test.setTimeout(120_000)
  const rendered = new Set<string>()
  for (const url of ["/", sectionHref(site), ...site.typeset]) {
    await visit(page, site, url, "light")
    for (const char of await page.evaluate(() => document.body.innerText)) {
      if (/\s/.test(char)) continue
      rendered.add(char)
      rendered.add(char.toUpperCase())
      rendered.add(char.toLowerCase())
    }
  }
  const glyphs = [...rendered].join("")
  expect(glyphs.length).toBeGreaterThan(60)

  const faces = families(site)
  const originals = await Promise.all(
    faces.map(async ({ family, source }) => ({
      family,
      base64: (await readFile(source)).toString("base64"),
    })),
  )

  const { lost, sentinel } = await page.evaluate(
    async ({ shipped, originals, glyphs, sentinelChar }) => {
      for (const { family } of originals) {
        await document.fonts.load(`1rem "${family}"`, glyphs + sentinelChar)
      }
      for (const { family, base64 } of originals) {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        const face = new FontFace(`source ${family}`, bytes.buffer)
        await face.load()
        document.fonts.add(face)
      }
      await document.fonts.ready
      const probe = document.createElement("span")
      probe.style.cssText =
        "position:absolute;top:-9999px;font-size:200px;white-space:pre"
      document.body.append(probe)
      const width = (char: string, stack: string) => {
        probe.textContent = char
        probe.style.fontFamily = stack
        return probe.getBoundingClientRect().width
      }
      const covers = (char: string, family: string) =>
        width(char, `"${family}", monospace`) !== width(char, "monospace") ||
        width(char, `"${family}", serif`) !== width(char, "serif")
      const lost: string[] = []
      const sentinel: string[] = []
      for (const family of shipped) {
        if (covers(sentinelChar, family)) sentinel.push(family)
        for (const char of glyphs) {
          if (covers(char, `source ${family}`) && !covers(char, family)) {
            lost.push(`${family}:${char}`)
          }
        }
      }
      probe.remove()
      return { lost, sentinel }
    },
    {
      shipped: faces.map((face) => face.family),
      originals,
      glyphs,
      sentinelChar: OUTSIDE_EVERY_FACE,
    },
  )
  expect(sentinel).toEqual([])
  expect(lost).toEqual([])
})
