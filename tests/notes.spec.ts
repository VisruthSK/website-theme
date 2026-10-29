import { expect, test, visit } from './sites.ts'

test.describe('footnotes', () => {
  test('the footnotes section sits at the bottom on small screens', async ({
    page,
    site,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await visit(page, site, site.footnotes, 'light')
    const section = page.locator('prose-content .footnotes')
    await expect(section).toBeVisible()
    await expect(section.locator('h2#footnotes')).toBeVisible()
    expect((await section.locator('li').first().innerText()).trim()).not.toBe(
      '',
    )
  })

  test('wide screens show notes in the margin or keep the section', async ({
    page,
    site,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await visit(page, site, site.footnotes, 'light')
    const notes = page.locator('prose-content side-note')
    if (!site.theme.features.marginNotes) {
      await expect(notes).toHaveCount(0)
      await expect(page.locator('prose-content .footnotes')).toBeVisible()
      return
    }
    await expect(page.locator('prose-content .footnotes')).toBeHidden()
    const prose = (await page.locator('prose-content').first().boundingBox())!
    const count = await notes.count()
    expect(count).toBeGreaterThan(0)
    let previousBottom = -Infinity
    for (let index = 0; index < count; index += 1) {
      const note = notes.nth(index)
      await expect(note).toBeVisible()
      await expect(note).toHaveAttribute('aria-label', /^Footnote \d+$/)
      const box = (await note.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(prose.x + prose.width)
      expect(box.x + box.width).toBeLessThanOrEqual(1280)
      expect(
        await note.evaluate((element) => getComputedStyle(element).whiteSpace),
      ).not.toBe('nowrap')
      const lineHeight = await note.evaluate((element) =>
        parseFloat(getComputedStyle(element).lineHeight),
      )
      const text = (await note.innerText()).trim()
      if (text.length > 60) expect(box.height).toBeGreaterThan(lineHeight * 1.5)
      expect(box.y).toBeGreaterThanOrEqual(previousBottom - 1)
      previousBottom = box.y + box.height
    }
    const number = notes.first().locator('> a:first-child')
    const target = await number.getAttribute('href')
    await number.click()
    expect(new URL(page.url()).hash).toBe(target)
  })

  test('going back from a note lands a quarter down and flashes its sentence', async ({
    page,
    site,
  }) => {
    test.skip(!site.theme.features.marginNotes, 'margin notes are off')
    const viewport = { width: 375, height: 667 }
    await page.setViewportSize(viewport)
    await visit(page, site, site.footnotes, 'light')
    const reference = page.locator('prose-content a[data-footnote-ref]').nth(1)
    await reference.click()
    await page
      .locator('prose-content .footnotes li:target a[data-footnote-backref]')
      .click()
    await expect
      .poll(async () => (await reference.boundingBox())?.y ?? -1)
      .toBeGreaterThan(viewport.height * 0.15)
    expect((await reference.boundingBox())!.y).toBeLessThan(
      viewport.height * 0.35,
    )
    const flashing = await page.evaluate(() =>
      [...document.querySelectorAll('prose-content *')]
        .filter(
          (element) =>
            getComputedStyle(element).animationName === 'footnote-flash',
        )
        .map((element) => element.className),
    )
    expect(flashing).toEqual(['footnote-sentence'])
  })
})

test('citations show their reference on hover', async ({ page, site }) => {
  test.skip(!site.citations, 'citations are switched off')
  await visit(page, site, site.citations!, 'light')
  const citation = page.locator('prose-content a.citation-link').first()
  expect(await citation.getAttribute('data-citation-preview')).toContain(
    'De Finibus Bonorum',
  )
  await citation.hover()
  await expect
    .poll(() =>
      citation.evaluate(
        (element) => getComputedStyle(element, '::after').opacity,
      ),
    )
    .toBe('1')
  await expect(page.locator('#references')).toBeAttached()
})
