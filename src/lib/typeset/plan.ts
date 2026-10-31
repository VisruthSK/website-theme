import {
  defaults,
  prepare,
  solve,
  withOpticalMargins,
  type Options,
  type Prepared,
} from '@kitlangton/justice'
import type { Constants } from './constants.ts'
import type { Faces } from './fonts.ts'
import type { EdgeTables } from './optical.ts'
import {
  ROMAN,
  Unsupported,
  type Gap as Extra,
  type Source,
  type Style,
} from './paragraph.ts'

export interface Band {
  from: number
  breaks: number[] | null
}

const CAP_GAP_REM = 1

const policyFor = ({ STRETCH, TRACKING }: Constants): Options => ({
  ...defaults,
  stretch: STRETCH,
  shrink: 0.2,
  tracking: TRACKING,
  compressionPenalty: 1,
  hanging: 0,
  opening: 0,
  protrusion: 1,
})

const MIN_WIDTH = 540
const MAX_WIDTH = 666
const SOLVE_STEP = 3
const SLACK = 0.3
const NON_BREAKING_HYPHEN = '‑'
const TOLERANCE = { ratio: 1.75, floor: 0.03 }
const ENDING_WEIGHT = 10

export function capWidth(
  letter: string,
  faces: Faces,
  { ROOT_RATIO }: Constants,
  capSizeRem: number,
): number {
  const size = capSizeRem / ROOT_RATIO
  const gap = CAP_GAP_REM / ROOT_RATIO
  return faces('cap', []).advance(letter.toUpperCase()) * size + gap
}

function featuresFor(style: Style): string[] {
  return [
    ...(style.face === 'mono' ? [] : ['onum', 'pnum']),
    ...(style.smallCaps ? ['smcp'] : []),
    '-liga',
    '-clig',
    '-calt',
  ]
}

function widthIn(faces: Faces) {
  return (piece: string, style: Style): number => {
    const text = piece.replaceAll(NON_BREAKING_HYPHEN, '-')
    const typeface = faces(style.face, featuresFor(style))
    const [missing] = typeface.missing(text)
    if (missing) {
      const code = missing.codePointAt(0)?.toString(16).toUpperCase()
      throw new Unsupported(`glyph U+${code} is not in the shipped font`)
    }
    return (typeface.advance(text) + style.spacing * text.length) * style.size
  }
}

function withExtras(prepared: Prepared, extras: readonly Extra[]): Prepared {
  const starts = prepared.starts ?? []
  const widths = prepared.widths.slice()
  for (const { offset, width } of extras) {
    const word = starts.findLastIndex((start) => start <= offset)
    for (let at = word + 1; at < widths.length; at += 1) widths[at] += width
  }
  return { ...prepared, widths }
}

export function prepareSource(
  { runs, gaps }: Source,
  faces: Faces,
  edges: EdgeTables,
): Prepared {
  const widthOf = widthIn(faces)
  const space = widthOf(' ', ROMAN)
  const prepared = prepare(
    runs.map(({ text, style }) => ({
      text: text.replaceAll('-', NON_BREAKING_HYPHEN),
      style,
    })),
    (piece, style) =>
      piece === ' ' ? space : style ? widthOf(piece, style) : 0,
  )

  const extras: Extra[] = [...gaps]
  let offset = 0
  for (const { text, style } of runs) {
    if (style) {
      for (const { index } of text.matchAll(/ /g)) {
        const before = text.slice(index - 1, index)
        const after = text.slice(index + 1, index + 2)
        const width =
          widthOf(before + ' ' + after, style) -
          widthOf(before, style) -
          widthOf(after, style) -
          space
        if (width) extras.push({ offset: offset + index, width })
      }
    }
    offset += text.length
  }

  const faceAt = (offset: number) => {
    let end = 0
    for (const { text, style } of runs) {
      end += text.length
      if (offset < end) return style?.face
    }
  }
  const protrusion = (offset: number, char: string, side: 1 | 2) => {
    const face = faceAt(offset) ?? 'roman'
    if (face === 'mono') return 0
    return (edges[face][char] ?? edges.roman[char])?.[side] ?? 0
  }
  return withOpticalMargins(withExtras(prepared, extras), (word, index) => {
    const text = word.replaceAll(NON_BREAKING_HYPHEN, '-')
    const start = prepared.starts?.[index] ?? 0
    return {
      start: protrusion(start, text[0], 1),
      end: protrusion(start + text.length - 1, text.at(-1) as string, 2),
    }
  })
}

interface Setting {
  indent: number
  cap: number
}

const WIDTHS = Array.from(
  { length: MAX_WIDTH - MIN_WIDTH + 1 },
  (_, index) => MIN_WIDTH + index,
)

const measureCache = new Map<string, (number | number[])[]>()

function measuresFor(
  { indent, cap }: Setting,
  { PLAN_SIZE, CAP_LINES, CAP_CLEARANCE }: Constants,
): (number | number[])[] {
  const key = `${indent}|${cap}|${PLAN_SIZE}`
  let measures = measureCache.get(key)
  if (!measures) {
    measures = WIDTHS.map((width) => {
      const em = (width - SLACK) / PLAN_SIZE
      if (cap) return [...Array(CAP_LINES).fill(em - cap - CAP_CLEARANCE), em]
      return indent ? [em - indent, em] : em
    })
    measureCache.set(key, measures)
  }
  return measures
}

function strain(
  prepared: Prepared,
  breaks: readonly number[],
  measure: number | readonly number[],
  policy: Options,
): number {
  const { widths, space, words, startProtrusions, endProtrusions } = prepared
  const lines = breaks.length + 1
  let total = 0
  for (let line = 0; line < lines; line += 1) {
    const from = line ? breaks[line - 1] : 0
    const to = line < breaks.length ? breaks[line] : words.length
    const available =
      (typeof measure === 'number'
        ? measure
        : measure[Math.min(line, measure.length - 1)]) +
      (endProtrusions?.[to - 1] ?? 0) +
      (startProtrusions?.[from] ?? 0)
    const gaps = to - from - 1
    const characters =
      prepared.characters[to] - prepared.characters[from] + gaps
    const natural = widths[to] - widths[from] + gaps * space
    const slack = available - natural
    const final = line === lines - 1
    if (final) {
      const length = natural / available
      total += ENDING_WEIGHT * Math.max(0, policy.lastLine - length) ** 2
      if (slack >= 0) continue
    }
    const capacity =
      gaps * space * (slack >= 0 ? policy.stretch : policy.shrink) +
      characters * policy.tracking
    if (slack < 0 && -slack > capacity) return Infinity
    const track = capacity
      ? Math.sign(slack) *
        Math.min(1, Math.abs(slack) / capacity) *
        policy.tracking
      : 0
    const deviation = gaps ? (slack - track * characters) / gaps / space : 0
    total += deviation * deviation
  }
  return total
}

function optimalBreaks(
  prepared: Prepared,
  measure: number | number[],
  capped: boolean,
  policy: Options,
): number[] | null {
  const { lines } = solve(prepared, measure, policy)
  const breaks = lines.slice(1).map((line) => line.start)
  const fits = lines.every((line) => line.last || line.residual >= -1e-6)
  return fits && !(capped && breaks[0] === 1) ? breaks : null
}

export function planParagraph(
  prepared: Prepared,
  setting: Setting,
  constants: Constants,
): Band[] {
  const policy = policyFor(constants)
  const measures = measuresFor(setting, constants)
  const optimal: (number[] | null)[] = []
  for (const [at, measure] of measures.entries()) {
    optimal.push(
      at % SOLVE_STEP
        ? optimal[at - 1]
        : optimalBreaks(prepared, measure, setting.cap > 0, policy),
    )
  }

  const unique = new Map<string, number[]>()
  for (const breaks of optimal) {
    if (breaks) unique.set(breaks.join(','), breaks)
  }
  const candidates = [...unique.values()]
  const best = measures.map((measure, at) => {
    const breaks = optimal[at]
    return breaks ? strain(prepared, breaks, measure, policy) : Infinity
  })

  const total = WIDTHS.length
  const runEnds = candidates.map((breaks) => {
    const ends = new Array<number>(total + 1).fill(total)
    for (let at = total - 1; at >= 0; at -= 1) {
      const fits =
        Number.isFinite(best[at]) &&
        strain(prepared, breaks, measures[at], policy) <=
          best[at] * TOLERANCE.ratio + TOLERANCE.floor
      ends[at] = fits ? ends[at + 1] : at
    }
    return ends
  })
  const reachFrom = (at: number) =>
    Math.max(at, ...runEnds.map((ends) => ends[at]))

  const bands: Band[] = []
  let at = 0
  while (at < total) {
    let reach = reachFrom(at)
    const chosen =
      reach > at ? runEnds.findIndex((ends) => ends[at] === reach) : -1
    if (chosen < 0) {
      reach = at + 1
      while (reach < total && reachFrom(reach) === reach) reach += 1
    }
    bands.push({
      from: WIDTHS[at],
      breaks: chosen < 0 ? null : candidates[chosen],
    })
    at = reach
  }
  return bands
}
