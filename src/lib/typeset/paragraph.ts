import type { Run } from '@kitlangton/justice'
import type { Element, ElementContent } from 'hast'

export interface Style {
  face: 'roman' | 'italic' | 'bold' | 'mono'
  size: number
  smallCaps: boolean
  spacing: number
}

export interface Gap {
  offset: number
  width: number
}

export interface Source {
  runs: Run<Style | null>[]
  gaps: Gap[]
  cap: string | null
}

export class Unsupported extends Error {}

export const ROMAN: Style = {
  face: 'roman',
  size: 1,
  smallCaps: false,
  spacing: 0,
}
const SUPERSCRIPT = 1 / 1.2
const CODE_SIZE = 0.75
const CODE_PADDING = 0.3 * CODE_SIZE
const ICON_WIDTH = 0.85
const NEUTRAL = new Set(['span', 'a', 'del', 'ins', 'mark', 'abbr'])

export const classes = (element: Element): string[] =>
  Array.isArray(element.properties.className)
    ? element.properties.className.map(String)
    : []

const sameStyle = (a?: Style | null, b?: Style | null) =>
  JSON.stringify(a) === JSON.stringify(b)

export function readParagraph(paragraph: Element): Source {
  let length = 0
  let cap: string | null = null
  const runs: Run<Style | null>[] = []
  const gaps: Gap[] = []

  const push = (value: string, style: Style | null) => {
    const last = runs.at(-1)
    if (last && sameStyle(last.style, style)) last.text += value
    else runs.push({ text: value, style })
    length += value.length
  }

  const append = (raw: string, style: Style | null) => {
    for (const piece of raw.split(/([ \t\r\n\f]+)/)) {
      if (!piece) continue
      if (/^[ \t\r\n\f]+$/.test(piece)) {
        if (length && !runs.at(-1)?.text.endsWith(' ')) push(' ', style)
      } else {
        push(piece, style)
      }
    }
  }

  const walk = (node: ElementContent, style: Style) => {
    if (node.type === 'text') return append(node.value, style)
    if (node.type !== 'element') return
    element(node, style)
  }

  const children = (node: Element, style: Style) => {
    for (const child of node.children) walk(child, style)
  }

  const element = (node: Element, style: Style) => {
    const own = classes(node)
    switch (node.tagName) {
      case 'side-note':
        return
      case 'em':
      case 'i':
        if (style.face === 'bold') throw new Unsupported('italic inside bold')
        return children(node, { ...style, face: 'italic' })
      case 'strong':
      case 'b':
        if (style.face !== 'roman') {
          throw new Unsupported('bold inside another face')
        }
        return children(node, { ...style, face: 'bold' })
      case 'sup':
        return children(node, { ...style, size: style.size * SUPERSCRIPT })
      case 'code': {
        if (style.face === 'bold') throw new Unsupported('code inside bold')
        const code = { ...style, face: 'mono' as const, size: CODE_SIZE }
        gaps.push({ offset: length, width: CODE_PADDING })
        children(node, code)
        gaps.push({ offset: length, width: CODE_PADDING })
        return
      }
    }

    if (node.tagName === 'span') {
      if (own.includes('drop-cap')) {
        const letter = node.children
          .filter((child) => child.type === 'text')
          .map((child) => child.value)
          .join('')
        if (length || letter.length !== 1) {
          throw new Unsupported('drop cap is not a single leading letter')
        }
        cap = letter
        return push(letter, null)
      }

      if (own.includes('opening-words')) {
        return children(node, { ...style, smallCaps: true, spacing: 0.03 })
      }

      if (own.includes('external-link-icon-wrap')) {
        for (const child of node.children) {
          if (child.type === 'text') walk(child, style)
          else if (child.type === 'element' && child.tagName !== 'svg') {
            throw new Unsupported(`unexpected <${child.tagName}> in link icon`)
          }
        }
        gaps.push({ offset: length, width: ICON_WIDTH * style.size })
        return
      }
    }

    if (NEUTRAL.has(node.tagName)) return children(node, style)
    throw new Unsupported(`<${node.tagName}>`)
  }

  children(paragraph, ROMAN)
  const last = runs.at(-1)
  if (last?.text.endsWith(' ')) {
    last.text = last.text.slice(0, -1)
    if (!last.text) runs.pop()
  }
  return { runs, gaps, cap }
}
