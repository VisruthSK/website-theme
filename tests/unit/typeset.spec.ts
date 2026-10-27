import { expect, test } from '@playwright/test'
import { SITES } from '../sites.ts'
import { typesetConstants } from '../../src/lib/typeset/constants.ts'
import { decodePlan, encodePlan } from '../../src/lib/typeset/encode.ts'
import { loadFaces, typefaceFiles } from '../../src/lib/typeset/fonts.ts'
import { edgeTables } from '../../src/lib/typeset/optical.ts'
import { Unsupported } from '../../src/lib/typeset/paragraph.ts'

const { theme } = SITES.example
const { constants, source } = typesetConstants(theme.prose)

test('the planner and the renderer read the same constants', async () => {
  const module = await import(
    `data:text/javascript,${encodeURIComponent(source)}`
  )
  expect({ ...module }).toEqual(constants)
  expect(constants.PLAN_SIZE).toBe(18)
  expect(constants.ROOT_RATIO).toBe(1.125)
  expect(constants.INDENT).toBe(1.35)
  expect(typesetConstants(SITES.minimal.theme.prose).constants).toMatchObject({
    PLAN_SIZE: 17,
    INDENT: 1.5,
  })
})

test('plans survive an encode and decode round trip', () => {
  const header = { words: 120, indent: constants.INDENT, cap: 2.4 }
  const bands = [
    { from: 540, breaks: [9, 18, 27, 36] },
    { from: 561, breaks: null },
    { from: 600, breaks: [10, 21, 31] },
  ]
  const encoded = encodePlan(header, bands, constants)
  expect(encoded).toMatch(/^[0-9a-z.;!~]+$/)
  expect(decodePlan(encoded, constants)).toEqual({ header, bands })
})

test('lines too long to encode fall back to native breaking', () => {
  const encoded = encodePlan(
    { words: 80, indent: 0, cap: 0 },
    [{ from: 540, breaks: [40, 80] }],
    constants,
  )
  expect(decodePlan(encoded, constants).bands).toEqual([
    { from: 540, breaks: null },
  ])
})

test('typeface files follow the configured body faces', () => {
  expect(typefaceFiles(theme.fonts)).toEqual({
    roman: 'plex-sans-400-normal.woff2',
    italic: 'plex-sans-400-italic.woff2',
    bold: 'plex-sans-600-normal.woff2',
    mono: 'plex-mono-400-normal.woff2',
    cap: 'plex-sans-600-normal.woff2',
  })
  expect(typefaceFiles(SITES.minimal.theme.fonts).mono).toBeUndefined()
})

for (const site of Object.values(SITES)) {
  test(`optical margins are measured from the ${site.name} fonts`, async () => {
    const faces = await loadFaces(
      `${site.dir}/${site.theme.fonts.directory}`,
      typefaceFiles(site.theme.fonts),
    )
    const edges = edgeTables(faces)
    for (const mark of ['.', ',', '”', '’']) {
      const [advance, , right] = edges.roman[mark]
      expect(right, mark).toBeCloseTo(advance, 6)
    }
    expect(edges.roman.n?.[1] ?? 0).toBeLessThan(edges.roman['“'][1])
    expect(edges.roman['“'][1]).toBeGreaterThan(0)
    expect(Object.keys(edges.roman).length).toBeGreaterThan(10)
    if (!site.theme.fonts.mono) {
      expect(() => faces('mono', [])).toThrow(Unsupported)
    }
  })
}
