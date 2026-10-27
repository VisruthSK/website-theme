import * as hb from 'harfbuzzjs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import wawoff2 from 'wawoff2'
import type { Theme } from '../../../config/theme'
import { Unsupported } from './paragraph.ts'

export type FaceName = 'roman' | 'italic' | 'bold' | 'mono' | 'cap'

export function typefaceFiles({
  body,
  mono,
  dropCap,
}: Theme['fonts']): Partial<Record<FaceName, string>> {
  const find = (weight: (value: number) => boolean, style: string) =>
    body.faces.find((face) => weight(face.weight) && face.style === style)?.file
  const roman = find((weight) => weight === 400, 'normal')
  return {
    roman,
    italic: find((weight) => weight === 400, 'italic') ?? roman,
    bold: find((weight) => weight >= 600, 'normal') ?? roman,
    mono: mono?.faces.find(({ style }) => style === 'normal')?.file,
    cap: dropCap?.file,
  }
}

interface FontFile {
  font: hb.Font
  upem: number
}

export class Typeface {
  readonly #file: FontFile
  readonly #features: hb.Feature[]
  readonly #advances = new Map<string, number>()

  constructor(file: FontFile, features: readonly string[]) {
    this.#file = file
    this.#features = features.flatMap((tag) => {
      const feature = hb.Feature.fromString(tag)
      return feature ? [feature] : []
    })
  }

  #shape(text: string) {
    const buffer = new hb.Buffer()
    buffer.addText(text)
    buffer.guessSegmentProperties()
    hb.shape(this.#file.font, buffer, this.#features)
    return buffer
  }

  advance(text: string): number {
    const known = this.#advances.get(text)
    if (known !== undefined) return known

    let total = 0
    for (const position of this.#shape(text).getGlyphPositions()) {
      total += position.xAdvance
    }
    const em = total / this.#file.upem
    this.#advances.set(text, em)
    return em
  }

  placed(text: string): { glyph: number; x: number }[] {
    const buffer = this.#shape(text)
    const positions = buffer.getGlyphPositions()
    let pen = 0
    return buffer.getGlyphInfos().map((info, index) => {
      const x = (pen + positions[index].xOffset) / this.#file.upem
      pen += positions[index].xAdvance
      return { glyph: info.codepoint, x }
    })
  }

  outline(glyph: number): { type: string; values: number[] }[] {
    const { font, upem } = this.#file
    return font.glyphToJson(glyph).map(({ type, values }) => ({
      type,
      values: values.map((value) => value / upem),
    }))
  }

  inkBounds(glyph: number): { left: number; right: number } {
    const { font, upem } = this.#file
    const { xBearing, width } = font.glyphExtents(glyph) ?? {
      xBearing: 0,
      width: 0,
    }
    return { left: xBearing / upem, right: (xBearing + width) / upem }
  }

  missing(text: string): string[] {
    const buffer = this.#shape(text)
    return buffer
      .getGlyphInfos()
      .filter((info) => info.codepoint === 0)
      .map((info) => text[info.cluster])
  }
}

async function loadFile(path: string): Promise<FontFile> {
  const source = await readFile(path)
  const data = path.endsWith('.woff2')
    ? await wawoff2.decompress(source)
    : source
  const face = new hb.Face(new hb.Blob(data))
  return { font: new hb.Font(face), upem: face.upem }
}

export async function loadFaces(
  directory: string,
  names: Partial<Record<FaceName, string>>,
) {
  const typefaces = new Map<string, Typeface>()
  const loaded = new Map<string, Promise<FontFile>>()
  const files = new Map(
    await Promise.all(
      Object.entries(names).flatMap(([name, file]) => {
        if (!file) return []
        if (!loaded.has(file)) loaded.set(file, loadFile(join(directory, file)))
        return [loaded.get(file)!.then((font) => [name, font] as const)]
      }),
    ),
  )

  return (name: FaceName, features: readonly string[]): Typeface => {
    const key = `${name}:${features.join(',')}`
    const known = typefaces.get(key)
    if (known) return known
    const file = files.get(name)
    if (!file) throw new Unsupported(`no ${name} font is configured`)
    const typeface = new Typeface(file, features)
    typefaces.set(key, typeface)
    return typeface
  }
}

export type Faces = Awaited<ReturnType<typeof loadFaces>>
