import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, visit, type Mode } from './sites.ts'

interface Offender {
  kind: string
  selector: string
  ratio: number
  need: number
  text: string
}

for (const mode of ['light', 'dark'] as Mode[]) {
  test(`all text and list numbers meet contrast (${mode})`, async ({
    page,
    site,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'computed colours do not vary by browser',
    )
    test.setTimeout(300_000)
    const sitemap = readFileSync(
      join(process.cwd(), site.dir, 'dist', 'sitemap-0.xml'),
      'utf8',
    )
    const paths = [
      ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        ([, loc]) => new URL(loc).pathname,
      ),
      '/404.html',
    ]
    const failures: string[] = []
    for (const path of paths) {
      await visit(page, site, path, mode)
      const offenders: Offender[] = await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        const linear = (c: number) =>
          c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        const luminance = ([r, g, b]: number[]) =>
          0.2126 * linear(r / 255) +
          0.7152 * linear(g / 255) +
          0.0722 * linear(b / 255)
        const read = () => [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
        const backdrop = (element: Element) => {
          const layers: string[] = []
          for (
            let current: Element | null = element;
            current;
            current = current.parentElement
          ) {
            const color = getComputedStyle(current).backgroundColor
            if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
              layers.unshift(color)
            }
          }
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, 1, 1)
          for (const color of layers) {
            ctx.fillStyle = color
            ctx.fillRect(0, 0, 1, 1)
          }
          return read()
        }
        const ratioOf = (foreground: string, element: Element) => {
          const background = backdrop(element)
          ctx.fillStyle = foreground
          ctx.fillRect(0, 0, 1, 1)
          const [high, low] = [luminance(read()), luminance(background)].sort(
            (a, b) => b - a,
          )
          return (high + 0.05) / (low + 0.05)
        }
        const shown = (element: Element) => {
          const box = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return (
            box.width > 0 &&
            box.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0'
          )
        }
        const label = (element: Element) =>
          element.tagName.toLowerCase() +
          (typeof element.className === 'string' && element.className
            ? `.${element.className.trim().split(/\s+/).join('.')}`
            : '')
        const found: Offender[] = []
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        )
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const element = node.parentElement
          const text = (node.textContent ?? '').trim()
          if (
            !text ||
            !element ||
            ['SCRIPT', 'STYLE'].includes(element.tagName) ||
            element.closest('[aria-hidden="true"]') ||
            !shown(element)
          ) {
            continue
          }
          const style = getComputedStyle(element)
          const size = parseFloat(style.fontSize)
          const large =
            size >= 24 || (size >= 18.66 && parseInt(style.fontWeight) >= 700)
          const need = large ? 3 : 4.5
          const ratio = ratioOf(style.color, element)
          if (ratio < need) {
            found.push({
              kind: 'text',
              selector: label(element),
              ratio: Math.round(ratio * 100) / 100,
              need,
              text: text.slice(0, 30),
            })
          }
        }
        for (const item of document.querySelectorAll('li')) {
          if (!shown(item)) continue
          const ordered = item.parentElement?.tagName === 'OL'
          const need = ordered ? 4.5 : 3
          const ratio = ratioOf(getComputedStyle(item, '::marker').color, item)
          if (ratio < need) {
            found.push({
              kind: ordered ? 'ordered marker' : 'bullet',
              selector: label(item.parentElement!),
              ratio: Math.round(ratio * 100) / 100,
              need,
              text: '',
            })
          }
        }
        return found
      })
      for (const { kind, selector, ratio, need, text } of offenders) {
        failures.push(
          `${path} ${kind} ${selector} ${ratio} < ${need} ${JSON.stringify(text)}`,
        )
      }
    }
    expect(failures).toEqual([])
  })
}
