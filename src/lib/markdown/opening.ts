import type { Element, ElementContent, Root, RootContent, Text } from 'hast'
import { defineHastPlugin } from 'satteri'

const PREAMBLE_MAX_BLOCKS = 4
const PREAMBLE_MAX_CHARS = 1200

type Node = Root | RootContent

function sumText(node: Node, measure: (text: string) => number): number {
  if (node.type === 'text') return measure(node.value)
  if (!('children' in node)) return 0
  return node.children.reduce(
    (total, child) => total + sumText(child, measure),
    0,
  )
}

const textLength = (node: Node) => sumText(node, (text) => text.trim().length)

const wordCount = (node: Node) =>
  sumText(node, (text) => text.match(/\S+/g)?.length ?? 0)

const OPENING_PATTERN = /^(\S)(\S*)(\s+)(\S+)([\s\S]*)$/
const MARKER_PATTERN = /^\{dropcap\}\s*/i
const MIN_BODY_CHARS = 120

const blocks = (root: Root): Element[] =>
  root.children.filter((child): child is Element => child.type === 'element')

function preambleEnd(all: Element[]): number {
  const hrIndex = all.findIndex((block) => block.tagName === 'hr')
  if (hrIndex === -1 || hrIndex > PREAMBLE_MAX_BLOCKS) return -1

  const characters = all
    .slice(0, hrIndex)
    .reduce((total, block) => total + textLength(block), 0)
  return characters < PREAMBLE_MAX_CHARS ? hrIndex : -1
}

function span(className: string, value: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [className] },
    children: [{ type: 'text', value }],
  }
}

const leadingText = (paragraph: Element): Text | undefined => {
  const first = paragraph.children.find((child) => child.type !== 'raw')
  return first?.type === 'text' ? first : undefined
}

export const opening = (dropCaps: boolean, minWords = 500) =>
  defineHastPlugin({
    name: 'opening',
    before(root, ctx) {
      const all = blocks(root)
      const end = preambleEnd(all)

      if (end !== -1) {
        for (const block of all.slice(0, end)) {
          if (block.tagName === 'p')
            ctx.setProperty(block, 'className', ['preamble'])
        }
      }

      const dropcap = ctx.data.astro?.frontmatter.dropcap
      if (!dropCaps || dropcap === false) return

      const flourish = (paragraph: Element, stripMarker: boolean) => {
        const leading = leadingText(paragraph)
        if (!leading) return

        const text = stripMarker
          ? leading.value.replace(MARKER_PATTERN, '')
          : leading.value
        const match = OPENING_PATTERN.exec(text)
        if (!match) {
          if (stripMarker)
            ctx.replaceNode(leading, { type: 'text', value: text })
          return
        }

        const [, initial, wordRest, gap, nextWord, remainder] = match
        const replacement: ElementContent[] = [
          span('drop-cap', initial),
          span('opening-words', `${wordRest}${gap}${nextWord}`),
        ]
        if (remainder) replacement.push({ type: 'text', value: remainder })
        ctx.replaceNode(leading, replacement)
        if (ctx.data.astro) ctx.data.astro.frontmatter.dropCap = true
      }

      const marked = all.filter((block) => {
        const leading = block.tagName === 'p' ? leadingText(block) : undefined
        return leading !== undefined && MARKER_PATTERN.test(leading.value)
      })
      if (marked.length > 0) {
        for (const paragraph of marked) flourish(paragraph, true)
        return
      }

      if (dropcap !== true && wordCount(root) < minWords) return

      const body = end === -1 ? all : all.slice(end + 1)
      const paragraph = body.find(
        (block) => block.tagName === 'p' && textLength(block) >= MIN_BODY_CHARS,
      )
      if (paragraph) flourish(paragraph, false)
    },
  })
