import type { Page } from '@playwright/test'
import { typesetConstants } from '../src/lib/typeset/constants.ts'
import { decodePlan } from '../src/lib/typeset/encode.ts'
import { expect, test } from './sites.ts'

const TABLET = 600
const viewports = [
  320, 390, 599, 600, 640, 700, 768, 1023, 1024, 1100, 1180, 1280, 1366, 1440,
  1536, 1920,
]

interface Reading {
  plan: string
  state: string
  size: number
  width: number
  actual: number[]
  overflow: boolean
  height: number
  lineHeight: number
  align: string
}

async function open(page: Page, route: string) {
  await page.goto(route)
  await page.evaluate(
    () =>
      (window as unknown as { __typesetReady: Promise<void> }).__typesetReady,
  )
}

async function settled(page: Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  await page.waitForFunction(
    () =>
      !(window as unknown as { __typesetBusy: () => boolean }).__typesetBusy(),
  )
}

async function readParagraphs(page: Page): Promise<Reading[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('p[data-j]')].map(
      (paragraph) => {
        const style = getComputedStyle(paragraph)
        const walker = document.createTreeWalker(
          paragraph,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) =>
              (node.parentElement as HTMLElement).closest('side-note, svg')
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT,
          },
        )
        const tops: number[] = []
        let inWord = false
        let measured = true
        let owed = 0
        for (
          let node = walker.nextNode() as Text | null;
          node;
          node = walker.nextNode() as Text | null
        ) {
          const capital = (node.parentElement as HTMLElement).closest(
            '.drop-cap',
          )
          for (let index = 0; index < node.data.length; index += 1) {
            const space = /\s/.test(node.data[index])
            if (space && inWord && !measured) owed += 1
            if (!space && !inWord) measured = false
            if (!space && !measured && !capital) {
              const range = document.createRange()
              range.setStart(node, index)
              range.setEnd(node, index + 1)
              const top = Math.round(range.getBoundingClientRect().top)
              tops.push(...Array<number>(owed + 1).fill(top))
              owed = 0
              measured = true
            }
            inWord = !space
          }
        }
        const actual: number[] = []
        for (let index = 1; index < tops.length; index += 1) {
          if (tops[index] > tops[index - 1] + 10) actual.push(index)
        }
        const notes = [...paragraph.querySelectorAll<HTMLElement>('side-note')]
        notes.forEach((note) => (note.style.display = 'none'))
        const hung = Math.max(
          0,
          ...[...paragraph.querySelectorAll<HTMLElement>('.jh')].map((box) => {
            const glyph = document.createRange()
            glyph.selectNodeContents(box)
            return (
              glyph.getBoundingClientRect().width -
              box.getBoundingClientRect().width
            )
          }),
        )
        const overflow =
          paragraph.scrollWidth > paragraph.clientWidth + 2.5 + hung
        notes.forEach((note) => (note.style.display = ''))
        return {
          plan: paragraph.dataset.j as string,
          state: paragraph.dataset.jState ?? 'missing',
          size: parseFloat(style.fontSize),
          width: paragraph.getBoundingClientRect().width,
          actual,
          overflow,
          height: paragraph.getBoundingClientRect().height,
          lineHeight: parseFloat(style.lineHeight),
          align: style.textAlign,
        }
      },
    ),
  )
}

test('every route lays out exactly as planned at every width', async ({
  page,
  site,
}) => {
  test.setTimeout(300_000)
  const { constants } = typesetConstants(site.theme.prose)
  for (const route of site.typeset) {
    await open(page, route)
    let checked = 0
    const fallbacks: string[] = []
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 })
      await settled(page)
      for (const reading of await readParagraphs(page)) {
        if (width < TABLET) {
          expect(reading.state, `${route} @${width}`).toBe('native')
          expect(reading.align, `${route} @${width} align`).toBe('left')
          continue
        }
        const { bands } = decodePlan(reading.plan, constants)
        const virtual = (reading.width / reading.size) * constants.PLAN_SIZE
        const band = bands.findLast((candidate) => candidate.from <= virtual)
        if (!band?.breaks?.length) {
          expect(reading.state, `${route} @${width}`).toBe('native')
          continue
        }
        if (reading.state === 'native') {
          fallbacks.push(`@${width}`)
          continue
        }
        expect(reading.overflow, `${route} @${width} overflow`).toBe(false)
        expect(reading.actual, `${route} @${width} breaks`).toEqual(band.breaks)
        expect(reading.height, `${route} @${width} height`).toBeLessThanOrEqual(
          (band.breaks.length + 1.5) * reading.lineHeight,
        )
        checked += 1
      }
    }
    expect(checked, route).toBeGreaterThan(0)
    const allowed = test.info().project.name.endsWith('firefox') ? 0.03 : 0.01
    expect(
      fallbacks.length / (checked + fallbacks.length),
      `${route} kept native justification ${fallbacks.join(' ')}`,
    ).toBeLessThanOrEqual(allowed)
  }
})

async function meanGapDeviation(page: Page): Promise<number> {
  const gaps = await page.evaluate(() => {
    const out: number[] = []
    for (const paragraph of document.querySelectorAll<HTMLElement>(
      'p[data-j]',
    )) {
      if (paragraph.querySelector('.drop-cap')) continue
      const walker = document.createTreeWalker(
        paragraph,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) =>
            (node.parentElement as HTMLElement).closest('side-note, svg')
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT,
        },
      )
      const words: { first: [Text, number]; last: [Text, number] }[] = []
      let current: (typeof words)[number] | null = null
      for (
        let node = walker.nextNode() as Text | null;
        node;
        node = walker.nextNode() as Text | null
      ) {
        for (let at = 0; at < node.data.length; at += 1) {
          if (/\s/.test(node.data[at])) current = null
          else if (!current) {
            current = { first: [node, at], last: [node, at] }
            words.push(current)
          } else current.last = [node, at]
        }
      }
      const rect = ([node, at]: [Text, number]) => {
        const range = document.createRange()
        range.setStart(node, at)
        range.setEnd(node, at + 1)
        return range.getBoundingClientRect()
      }
      const placed = words.map((word) => ({
        first: rect(word.first),
        last: rect(word.last),
      }))
      const lines: (typeof placed)[] = []
      let line = [placed[0]]
      for (let at = 1; at < placed.length; at += 1) {
        if (placed[at].first.top > line[line.length - 1].first.top + 10) {
          lines.push(line)
          line = []
        }
        line.push(placed[at])
      }
      const space = document.createElement('span')
      space.textContent = 'x x'
      space.style.wordSpacing = 'normal'
      space.style.letterSpacing = 'normal'
      paragraph.append(space)
      const range = document.createRange()
      range.setStart(space.firstChild!, 1)
      range.setEnd(space.firstChild!, 2)
      const natural = range.getBoundingClientRect().width
      space.remove()
      for (const entries of lines) {
        if (entries.length < 2) continue
        let total = 0
        for (let at = 1; at < entries.length; at += 1) {
          total += entries[at].first.left - entries[at - 1].last.right
        }
        out.push(Math.abs(total / (entries.length - 1) / natural - 1))
      }
    }
    return out
  })
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
}

test('word spacing is far more even than native justification', async ({
  page,
  site,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'blocking the script needs routing')
  test.setTimeout(180_000)
  const result = { typeset: 0, native: 0 }
  let samples = 0
  for (const route of site.typeset.slice(0, 3)) {
    for (const width of [700, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await open(page, route)
      result.typeset += await meanGapDeviation(page)
      await page.route('**/typeset.*.js', (request) => request.abort())
      await page.goto(route)
      result.native += await meanGapDeviation(page)
      await page.unroute('**/typeset.*.js')
      samples += 1
    }
  }
  expect(result.typeset / samples).toBeLessThan(0.5)
  expect(result.typeset).toBeLessThan(result.native * 0.6)
})

test('opening and closing characters protrude by the planned amount', async ({
  page,
  site,
}) => {
  test.setTimeout(180_000)
  const errors: Record<string, number[]> = { trailing: [], leading: [] }
  for (const route of site.typeset) {
    for (const width of [700, 1100, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await open(page, route)
      const readings = await page.evaluate(() => {
        const found: { side: string; offset: number; planned: number }[] = []
        for (const paragraph of document.querySelectorAll<HTMLElement>('p.j')) {
          const box = paragraph.getBoundingClientRect()
          const style = getComputedStyle(paragraph)
          const left = box.left + parseFloat(style.paddingLeft)
          const right = box.right - parseFloat(style.paddingRight)
          for (const hang of paragraph.querySelectorAll<HTMLElement>('.jh')) {
            const rect = hang.getBoundingClientRect()
            if (rect.top >= box.bottom - 30) continue
            const glyph = document.createRange()
            glyph.selectNodeContents(hang)
            const ink = glyph.getBoundingClientRect()
            found.push({
              side: 'trailing',
              offset: ink.right - right,
              planned: ink.width - rect.width,
            })
          }
          for (const span of paragraph.querySelectorAll<HTMLElement>('.jl')) {
            const rect = span.getBoundingClientRect()
            const size = parseFloat(getComputedStyle(span).fontSize)
            if (span.style.marginLeft && rect.top > box.top + 40) {
              found.push({
                side: 'leading',
                offset: left - rect.left,
                planned: -parseFloat(span.style.marginLeft) * size,
              })
            }
          }
        }
        return found
      })
      for (const { side, offset, planned } of readings) {
        errors[side].push(Math.abs(offset - planned))
      }
    }
  }

  const percentile = (values: number[], share: number) =>
    [...values].sort((x, y) => x - y)[Math.floor(values.length * share)]
  const worst = test.info().project.name.endsWith('webkit') ? 3 : 1
  expect(errors.trailing.length).toBeGreaterThan(50)
  expect(percentile(errors.trailing, 0.95)).toBeLessThan(worst)
  expect(errors.leading.length).toBeGreaterThan(5)
  expect(percentile(errors.leading, 0.95)).toBeLessThan(1)
})

test('typeset paragraphs keep their planned height at fractional scales', async ({
  browser,
  site,
}) => {
  test.setTimeout(180_000)
  for (const deviceScaleFactor of [1.25, 1.5, 2]) {
    const context = await browser.newContext({
      deviceScaleFactor,
      viewport: { width: 1600, height: 900 },
      baseURL: `http://127.0.0.1:${site.port}`,
    })
    const page = await context.newPage()
    for (const route of site.typeset) {
      await open(page, route)
      await settled(page)
      const taller = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('p.j')]
          .filter((paragraph) => {
            const lineHeight = parseFloat(
              getComputedStyle(paragraph).lineHeight,
            )
            const lines = paragraph.querySelectorAll('.jb').length + 1
            return (
              paragraph.getBoundingClientRect().height >
              (lines + 0.5) * lineHeight
            )
          })
          .map((paragraph) => paragraph.textContent?.slice(0, 24)),
      )
      expect(taller, `${route} @${deviceScaleFactor}x`).toEqual([])
    }
    await context.close()
  }
})

test('the stylesheet uses the prose settings the planner assumes', async ({
  page,
  site,
}) => {
  const { constants } = typesetConstants(site.theme.prose)
  await open(page, site.typeset[0])
  const measured = await page.evaluate(() => {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
    const indented = [
      ...document.querySelectorAll<HTMLElement>('prose-content > p'),
    ].find(
      (paragraph) =>
        paragraph.previousElementSibling?.tagName === 'P' &&
        !paragraph.querySelector('.drop-cap') &&
        !paragraph.classList.contains('preamble'),
    ) as HTMLElement
    const style = getComputedStyle(indented)
    const size = parseFloat(style.fontSize)
    return {
      ratio: size / root,
      indent: parseFloat(style.textIndent) / size,
      leading: parseFloat(style.lineHeight) / root,
    }
  })
  expect(measured.ratio).toBeCloseTo(constants.ROOT_RATIO, 2)
  expect(measured.indent).toBeCloseTo(constants.INDENT, 2)
  expect(measured.leading).toBeCloseTo(
    parseFloat(site.theme.prose.lineHeight),
    2,
  )
})

test('paragraphs keep native justification under a user spacing override', async ({
  page,
  site,
}) => {
  await open(page, site.typeset[0])
  await page.addStyleTag({
    content:
      'prose-content p { letter-spacing: 0.12em !important; word-spacing: 0.16em !important }',
  })
  await page.setViewportSize({ width: 1100, height: 900 })
  await settled(page)
  const states = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('p[data-j]')].map(
      (paragraph) => paragraph.dataset.jState,
    ),
  )
  expect(states.length).toBeGreaterThan(0)
  expect(states.filter((state) => state !== 'native')).toEqual([])
})
