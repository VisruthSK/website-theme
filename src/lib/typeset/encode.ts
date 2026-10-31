import type { Constants } from './constants.ts'
import type { Band } from './plan.ts'

export interface Header {
  words: number
  indent: number
  cap: number
}

const MAX_LINE_WORDS = 35
const radix = (value: number) => Math.round(value).toString(36)

function lineWords(breaks: readonly number[]): number[] {
  return breaks.map((end, index) => end - (breaks[index - 1] ?? 0))
}

export function encodePlan(
  { words, indent, cap }: Header,
  bands: Band[],
  { CAP_SCALE }: Constants,
): string {
  const parts = [
    [radix(words), indent ? 1 : 0, radix(cap * CAP_SCALE)].join('.'),
  ]
  let previous = 0
  for (const { from, breaks } of bands) {
    const delta = radix(from - previous)
    previous = from
    const counts = breaks ? lineWords(breaks) : []
    const encodable = counts.length && counts.every((n) => n <= MAX_LINE_WORDS)
    parts.push(`${delta}${encodable ? `!${counts.map(radix).join('')}` : '~'}`)
  }
  return parts.join(';')
}

export function decodePlan(
  data: string,
  { CAP_SCALE, INDENT }: Constants,
): { header: Header; bands: Band[] } {
  const [head, ...rest] = data.split(';')
  const [words, indent, cap] = head.split('.')

  let from = 0
  const bands = rest.map((part): Band => {
    const [delta, counts] = part.split(/[!~]/)
    from += parseInt(delta, 36)
    if (!counts) return { from, breaks: null }
    let end = 0
    return {
      from,
      breaks: [...counts].map((count) => (end += parseInt(count, 36))),
    }
  })

  return {
    header: {
      words: parseInt(words, 36),
      indent: indent === '1' ? INDENT : 0,
      cap: parseInt(cap, 36) / CAP_SCALE,
    },
    bands,
  }
}
