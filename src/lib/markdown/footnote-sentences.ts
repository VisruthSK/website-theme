import { defineMdastPlugin } from 'satteri'

interface Node {
  type: string
  value?: string
  children?: Node[]
}

interface Edits {
  before: Node[]
  inside: { offset: number; tag: Node }[]
  after: Node[]
}

const OPEN = { type: 'html', value: '<span class="footnote-sentence">' }
const CLOSE = { type: 'html', value: '</span>' }

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
const TITLE = /\b(?:Dr|Mr|Mrs|Ms|Prof|St|Mt|Jr|Sr)\.\s*$/

const plainText = (node: Node): string =>
  node.type === 'footnoteReference' || node.type === 'html'
    ? ''
    : (node.value ?? node.children?.map(plainText).join('') ?? '')

function sentencesOf(text: string) {
  const sentences: { start: number; end: number }[] = []
  for (const { index, segment } of segmenter.segment(text)) {
    const previous = sentences.at(-1)
    if (previous && TITLE.test(text.slice(previous.start, previous.end))) {
      previous.end = index + segment.length
    } else {
      sentences.push({ start: index, end: index + segment.length })
    }
  }
  return sentences
}

function split(value: string, inside: Edits['inside']): Node[] {
  const pieces: Node[] = []
  let cursor = 0
  for (const { offset, tag } of inside.toSorted(
    (a, b) => a.offset - b.offset,
  )) {
    if (offset > cursor) {
      pieces.push({ type: 'text', value: value.slice(cursor, offset) })
    }
    pieces.push(tag)
    cursor = offset
  }
  if (cursor < value.length) {
    pieces.push({ type: 'text', value: value.slice(cursor) })
  }
  return pieces
}

export const footnoteSentences = defineMdastPlugin({
  name: 'footnote-sentences',
  paragraph(node, ctx) {
    const children = node.children as unknown as Node[]
    const references = children.flatMap((child, index) =>
      child.type === 'footnoteReference' ? [index] : [],
    )
    if (references.length === 0) return

    const texts = children.map(plainText)
    const text = texts.join('')
    const starts = texts.map(
      (_, index) => texts.slice(0, index).join('').length,
    )
    const childAt = (position: number) =>
      texts.findIndex((part, index) => starts[index] + part.length > position)

    const sentences = sentencesOf(text)
    const bySentence = new Map<(typeof sentences)[number], number[]>()
    for (const reference of references) {
      const position = starts[reference]
      const sentence =
        sentences.find(
          ({ start, end }) => start < position && position <= end,
        ) ?? sentences[0]
      bySentence.set(sentence, [...(bySentence.get(sentence) ?? []), reference])
    }

    const edits = new Map<number, Edits>()
    const editsFor = (child: number) => {
      const existing = edits.get(child)
      if (existing) return existing
      const created: Edits = { before: [], inside: [], after: [] }
      edits.set(child, created)
      return created
    }

    for (const [{ start, end }, sentenceReferences] of bySentence) {
      const first = childAt(start)
      const opening = start - starts[first]
      if (children[first].type === 'text' && opening > 0) {
        editsFor(first).inside.push({ offset: opening, tag: OPEN })
      } else {
        editsFor(first).before.push(OPEN)
      }

      const finish = start + text.slice(start, end).trimEnd().length
      const lastReference = sentenceReferences.at(-1) as number
      const last = Math.max(childAt(finish - 1), lastReference)
      const closing = finish - starts[last]
      if (
        children[last].type === 'text' &&
        last !== lastReference &&
        closing < texts[last].length
      ) {
        editsFor(last).inside.push({ offset: closing, tag: CLOSE })
      } else {
        editsFor(last).after.push(CLOSE)
      }
    }

    for (const [child, { before, inside, after }] of edits) {
      const original = children[child]
      const middle =
        original.type === 'text'
          ? split(original.value ?? '', inside)
          : [original]
      ctx.replaceNode(
        original as never,
        [...before, ...middle, ...after] as never,
      )
    }
  },
})
