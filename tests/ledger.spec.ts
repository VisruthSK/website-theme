import { baseOf, expect, test } from './sites.ts'

test.describe('list page', () => {
  test.beforeEach(({ site }) => {
    test.skip(!site.ledger, 'the site has no list page')
  })

  test('groups entries by year and handles the rare cases', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const years = await page.locator('h2[data-year]').allTextContents()
    expect(years).toEqual(['2026', '2025', 'Undated'])

    const ids = await page
      .locator('.interactive-card .card-title')
      .evaluateAll((titles) => titles.map((title) => title.id))
    expect(ids).toEqual([
      'the-gift-of-the-magi-01',
      'the-selfish-giant-02',
      'moby-dick-01',
      'the-selfish-giant-01',
      'walden-01',
      'dracula-01',
    ])

    await expect(page.locator('main')).not.toContainText('/10')
    await expect(page.locator('.dnf')).toHaveText('DNF')
    await expect(page.locator('.chip')).toHaveCount(1)
    await expect(page.locator('.score').first()).toHaveText('9')
  })

  test('shows full dates and prints loose dates as written', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const card = (title: string) =>
      page.locator('.interactive-card', { hasText: title }).first()
    await expect(card('The Gift of the Magi')).toContainText(
      '1 October 2026 – 14 October 2026',
    )
    await expect(card('The Gift of the Magi')).toContainText('1905')
    await expect(card('Moby-Dick')).toContainText('18 October 1851')
    await expect(card('Walden')).toContainText('2 March 2025 – 20 March 2025')
    await expect(card('Dracula')).not.toContainText('–')
    await expect(
      page.locator('.interactive-card', { hasText: 'May 1888' }),
    ).toHaveCount(2)
  })

  test('the review link and favorite share a row when there is no note', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const card = page.locator('.interactive-card', {
      hasText: 'The Gift of the Magi',
    })
    await card.locator('.note').evaluate((note) => note.remove())
    const link = await card.getByRole('link', { name: 'Essay' }).boundingBox()
    const favorite = await card.locator('.chip').boundingBox()
    expect(link).not.toBeNull()
    expect(favorite).not.toBeNull()
    expect(
      Math.abs(
        link!.y + link!.height / 2 - (favorite!.y + favorite!.height / 2),
      ),
    ).toBeLessThan(2)
  })

  test('a note and favorite share the bottom row when there is no review', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const card = page.locator('.interactive-card', {
      hasText: 'The Gift of the Magi',
    })
    await card.locator('.link').evaluate((link) => link.remove())
    const note = await card.locator('.note p').last().boundingBox()
    const favorite = await card.locator('.chip').boundingBox()
    expect(note).not.toBeNull()
    expect(favorite).not.toBeNull()
    expect(favorite!.y).toBeLessThan(note!.y + note!.height)
    expect(favorite!.y + favorite!.height).toBeGreaterThan(note!.y)
  })

  test('favorite badges have the same typography in both positions', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const card = page.locator('.interactive-card', {
      hasText: 'The Gift of the Magi',
    })
    await card.locator('.side').evaluate((side) => {
      const badge = side.closest('.interactive-card')!.querySelector('.chip')!
      side.appendChild(badge.cloneNode(true))
    })
    const badges = await card.locator('.chip').evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return {
          family: style.fontFamily,
          size: style.fontSize,
          width: rect.width,
          height: rect.height,
        }
      }),
    )
    expect(badges).toHaveLength(2)
    expect(badges[0]).toEqual(badges[1])
  })

  test('Markdown note links use normal visible link styling and are clickable', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const card = page.locator('.interactive-card', {
      hasText: 'The Gift of the Magi',
    })
    await card.locator('.note').evaluate((note) => {
      note.insertAdjacentHTML(
        'beforeend',
        '<p><a href="https://example.com/">Article</a></p>',
      )
    })
    const link = card.getByRole('link', { name: 'Article' })
    await link.scrollIntoViewIfNeeded()
    await expect(link).toHaveCSS('text-decoration-line', 'underline')
    const color = await link.evaluate(
      (element) => getComputedStyle(element).textDecorationColor,
    )
    expect(color).not.toBe('rgba(0, 0, 0, 0)')
    expect(
      await link.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return (
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ) === element
        )
      }),
    ).toBe(true)
  })

  test('a link opens in the same tab and a card links to itself', async ({
    page,
    site,
  }) => {
    await page.goto(site.ledger!.path)
    const link = page.getByRole('link', { name: 'Essay', exact: true }).first()
    expect(await link.getAttribute('target')).toBeNull()
    expect(await link.getAttribute('href')).toBe(
      `${baseOf(site)}/essays/the-gift-of-the-magi/`,
    )

    await page
      .locator('.interactive-card', { hasText: 'Moby-Dick' })
      .click({ position: { x: 24, y: 24 } })
    await expect(page).toHaveURL(/#moby-dick-01$/)
  })
})

test('collections and Recent group entries under year headings, unpaginated', async ({
  page,
  site,
}) => {
  for (const path of ['/recent/', `/${site.theme.sections[0].slug}/`]) {
    await page.goto(path)
    expect(await page.locator('h2[data-year]').count(), path).toBeGreaterThan(0)
    await expect(page.locator('.pagination-nav'), path).toHaveCount(0)
  }
})
