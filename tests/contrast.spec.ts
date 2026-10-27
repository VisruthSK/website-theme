import { expect, sectionHref, test, visit, type Mode } from './sites.ts'

const pairs = [
  { name: 'body text', fg: '--foreground', bg: '--background', need: 4.5 },
  { name: 'ink-strong', fg: '--ink-strong', bg: '--background', need: 4.5 },
  { name: 'ink-soft', fg: '--ink-soft', bg: '--background', need: 4.5 },
  { name: 'ink-subtle', fg: '--ink-subtle', bg: '--background', need: 4.5 },
  { name: 'ink-muted', fg: '--ink-muted', bg: '--background', need: 4.5 },
  { name: 'ink-faint', fg: '--ink-faint', bg: '--background', need: 3 },
  { name: 'muted', fg: '--muted-foreground', bg: '--background', need: 4.5 },
  { name: 'flourish', fg: '--flourish', bg: '--background', need: 4.5 },
  { name: 'focus ring', fg: '--ring', bg: '--background', need: 3 },
  { name: 'primary', fg: '--primary', bg: '--background', need: 3 },
  { name: 'danger', fg: '--danger-foreground', bg: '--danger', need: 4.5 },
  { name: 'accent', fg: '--accent-foreground', bg: '--accent', need: 4.5 },
  { name: 'hover', fg: '--foreground', bg: '--surface-hover', need: 4.5 },
  { name: 'highlight', fg: '--foreground', bg: '--highlight', need: 4.5 },
  { name: 'warning', fg: '--ink-strong', bg: '--surface-warning', need: 4.5 },
]

for (const mode of ['light', 'dark'] as Mode[]) {
  test(`the palette meets contrast (${mode})`, async ({ page, site }) => {
    await visit(page, site, sectionHref(site), mode)
    const { results, unresolved } = await page.evaluate((specs) => {
      const root = getComputedStyle(document.documentElement)
      const unresolved = [
        ...new Set(specs.flatMap((spec) => [spec.fg, spec.bg])),
      ].filter((token) => !root.getPropertyValue(token).trim())
      const probe = document.createElement('span')
      document.body.append(probe)
      const cssColor = (token: string) => {
        probe.style.color = ''
        probe.style.color = `var(${token})`
        return getComputedStyle(probe).color
      }
      const pageBg = cssColor('--background')
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const composited = (token: string) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = pageBg
        ctx.fillRect(0, 0, 1, 1)
        ctx.fillStyle = cssColor(token)
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
      }
      const linear = (c: number) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      const luminance = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => linear(v / 255))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const results = specs.map((spec) => {
        const [high, low] = [
          luminance(composited(spec.fg)),
          luminance(composited(spec.bg)),
        ].sort((a, b) => b - a)
        return { ...spec, ratio: (high + 0.05) / (low + 0.05) }
      })
      probe.remove()
      return { results, unresolved }
    }, pairs)

    expect(unresolved).toEqual([])
    expect(
      results
        .filter((result) => result.ratio < result.need)
        .map((result) => `${result.name} ${result.ratio.toFixed(2)}`),
    ).toEqual([])
  })
}
