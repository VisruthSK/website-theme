/*
 * A build-time port of the optical protrusion measurement in Justif
 * (https://github.com/lyallcooper/justif, src/dom/optical.ts). Justif
 * rasterizes a font's glyphs on a canvas in the visitor's browser; this
 * rasterizes the shipped outlines instead and keeps its model and constants:
 * a glyph's perceived position is the centroid of the ink in a window at the
 * margin, its protrusion is the difference from an ordinary stem, bounded by
 * the glyph's own geometry and shrunk by the face's measurement noise.
 *
 * Justif is MIT licensed:
 *
 * Copyright (c) 2026 Lyall Cooper
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { Faces, Typeface } from "./fonts.ts"

type Side = "left" | "right"

const RASTER = 32
const PAD = RASTER / 2
const STRIP = PAD + Math.round(RASTER * 1.6)
const ASCENT = Math.round(RASTER * 1.05)
const HEIGHT = ASCENT + Math.round(RASTER * 0.4)
const SUBROWS = 4
const CURVE_STEPS = 8

const LAMBDA = 0.45
const NOISE = 1
const ALLOWANCE = 0.05
const HEFT = 0.3
const INK = 0.2
const MINIMUM = 15

const TAILS = ["nono", "aese"]
const HEADS = ["onon", "esea"]
const STEMS = {
  left: [..."nhmurbpk"],
  right: [..."dhnmulkq"],
}
const POPULATION = {
  left: [...("tasw" + "ocnhdrilfmpbeg")],
  right: [..."esdtnyrolfhmagkwpx"],
}
const CANDIDATES = [
  ..."“”‘’\"'.,;:!?-–—‐()[]{}«»‹›¡¿*/@%~_+‚„<>\\|=&",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."0123456789",
]

type Edge = [number, number, number, number]

function outlineEdges(face: Typeface, text: string, origin: number): Edge[] {
  const edges: Edge[] = []
  for (const { glyph, x } of face.placed(text)) {
    const at = (px: number, py: number): [number, number] => [
      origin + (x + px) * RASTER,
      ASCENT - py * RASTER,
    ]
    let start: [number, number] = [0, 0]
    let pen: [number, number] = [0, 0]
    const line = (to: [number, number]) => {
      edges.push([...pen, ...to])
      pen = to
    }
    for (const { type, values } of face.outline(glyph)) {
      if (type === "M") {
        pen = start = at(values[0], values[1])
      } else if (type === "L") {
        line(at(values[0], values[1]))
      } else if (type === "Q" || type === "C") {
        const points = [pen]
        for (let i = 0; i < values.length; i += 2) {
          points.push(at(values[i], values[i + 1]))
        }
        for (let step = 1; step <= CURVE_STEPS; step += 1) {
          const t = step / CURVE_STEPS
          const mix = (a: number[]): number[] =>
            a.length === 1
              ? a
              : mix(
                  a
                    .slice(1)
                    .map((value, index) => value * t + a[index] * (1 - t)),
                )
          line([
            mix(points.map((point) => point[0]))[0],
            mix(points.map((point) => point[1]))[0],
          ])
        }
      } else if (type === "Z") {
        line(start)
      }
    }
  }
  return edges
}

function ink(face: Typeface, text: string, origin: number): Float64Array {
  const edges = outlineEdges(face, text, origin)
  const cover = new Float64Array(STRIP * HEIGHT)
  for (let row = 0; row < HEIGHT; row += 1) {
    for (let sub = 0; sub < SUBROWS; sub += 1) {
      const y = row + (sub + 0.5) / SUBROWS
      const crossings: [number, number][] = []
      for (const [x0, y0, x1, y1] of edges) {
        if (y0 <= y === y1 <= y) continue
        crossings.push([
          x0 + ((y - y0) * (x1 - x0)) / (y1 - y0),
          y1 > y0 ? 1 : -1,
        ])
      }
      crossings.sort((a, b) => a[0] - b[0])
      let winding = 0
      for (let index = 0; index < crossings.length - 1; index += 1) {
        winding += crossings[index][1]
        if (winding === 0) continue
        const from = Math.max(0, crossings[index][0])
        const to = Math.min(STRIP, crossings[index + 1][0])
        for (let pixel = Math.floor(from); pixel < to; pixel += 1) {
          const overlap = Math.min(to, pixel + 1) - Math.max(from, pixel)
          if (overlap > 0) cover[row * STRIP + pixel] += overlap / SUBROWS
        }
      }
    }
  }
  return cover
}

function geometry(face: Typeface, glyph: string) {
  const cover = ink(face, glyph, PAD)
  let mass = 0
  let moment = 0
  cover.forEach((alpha, index) => {
    if (alpha < INK) return
    mass += alpha
    moment += alpha * ((index % STRIP) + 0.5 - PAD)
  })
  return mass > 0 ? { mass, centre: moment / mass } : null
}

function centroid(face: Typeface, text: string, side: Side): number | null {
  const advance = face.advance(text) * RASTER
  const cover = ink(face, text, side === "left" ? PAD : STRIP - PAD - advance)
  const columns = new Float64Array(STRIP)
  cover.forEach((alpha, index) => {
    if (alpha > INK) columns[index % STRIP] += alpha - INK
  })
  let sum = 0
  let moment = 0
  columns.forEach((column, x) => {
    const depth = side === "left" ? x - PAD : STRIP - PAD - 1 - x
    const weight = column * Math.exp(-Math.max(0, depth) / RASTER / LAMBDA)
    sum += weight
    moment += weight * (depth + 0.5)
  })
  return sum > 0 ? moment / sum : null
}

const mean = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length

const present = (values: (number | null)[]) =>
  values.filter((value): value is number => value !== null)

function measureProtrusion(face: Typeface): Record<string, [number, number]> {
  const advanceOf = (char: string) => face.advance(char) * RASTER
  const solid = new Map<string, NonNullable<ReturnType<typeof geometry>>>()
  for (const char of [...CANDIDATES, "n"]) {
    const found = geometry(face, char)
    if (found) solid.set(char, found)
  }
  const reference = solid.get("n")!.mass

  const table: Record<string, [number, number]> = {}
  for (const side of ["left", "right"] as const) {
    const contexts = side === "left" ? TAILS : HEADS
    const position = (char: string): number | null => {
      const readings = present(
        contexts.map((context) =>
          centroid(
            face,
            side === "left" ? char + context : context + char,
            side,
          ),
        ),
      )
      return readings.length ? mean(readings) : null
    }
    const known = (chars: string[]) => present(chars.map(position))

    const ordinary = mean(known(STEMS[side]))
    const population = known(POPULATION[side])
    const centre = mean(population)
    const noise =
      population.length > 1
        ? NOISE *
          Math.sqrt(
            population.reduce((sum, value) => sum + (value - centre) ** 2, 0) /
              (population.length - 1),
          )
        : 0

    const bearingOf = (char: string): number => {
      const [{ glyph }] = face.placed(char)
      const { left, right } = face.inkBounds(glyph)
      return side === "left" ? left * RASTER : advanceOf(char) - right * RASTER
    }
    const stem = mean(STEMS[side].map(bearingOf))

    for (const char of CANDIDATES) {
      const found = position(char)
      const shape = solid.get(char)
      const advance = advanceOf(char)
      if (found === null || !shape || advance <= 0) continue

      const raw = found - ordinary
      const reading =
        raw * Math.max(0, 1 - (noise / (Math.abs(raw) || 1e-9)) ** 2)
      const inkLine = bearingOf(char) - stem
      const middle = side === "left" ? shape.centre : advance - shape.centre
      const light = Math.exp(-((shape.mass / reference / HEFT) ** 2))
      const ceiling = Math.max(
        0,
        (1 - light) * inkLine + light * middle + RASTER * ALLOWANCE,
      )
      const floor = Math.min(inkLine, ceiling)
      const permille = Math.round(
        (Math.min(Math.max(reading, floor), ceiling) / advance) * 1000,
      )
      if (Math.abs(permille) < MINIMUM) continue
      table[char] ??= [0, 0]
      table[char][side === "left" ? 0 : 1] = permille
    }
  }
  return table
}

const HANGING_END = [..."'\"‘’“”‚„‹›«».,"]

type Edges = Record<string, readonly [number, number, number]>
export type EdgeTables = Record<"roman" | "italic" | "bold", Edges>

const DISTINCT = 0.02

function edgeTable(
  faces: Faces,
  face: keyof EdgeTables,
  also: Iterable<string> = [],
): Edges {
  const typeface = faces(face, ["pnum"])
  const measured = measureProtrusion(typeface)
  const table: Edges = {}
  for (const char of new Set([
    ...Object.keys(measured),
    ...HANGING_END,
    ...also,
  ])) {
    const advance = typeface.advance(char)
    const [left = 0, right = 0] = measured[char] ?? []
    table[char] = [
      advance,
      (Math.max(0, left) / 1000) * advance,
      HANGING_END.includes(char)
        ? advance
        : (Math.max(0, right) / 1000) * advance,
    ]
  }
  return table
}

export function edgeTables(faces: Faces): EdgeTables {
  const roman = edgeTable(faces, "roman")
  const distinct = (face: "italic" | "bold"): Edges =>
    Object.fromEntries(
      Object.entries(edgeTable(faces, face, Object.keys(roman))).filter(
        ([char, edge]) =>
          !roman[char] ||
          edge.some((value, i) => Math.abs(value - roman[char][i]) >= DISTINCT),
      ),
    )
  return { roman, italic: distinct("italic"), bold: distinct("bold") }
}
