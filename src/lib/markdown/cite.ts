import {
  defineMdastPlugin,
  type MdastPluginDefinition,
  type PluginFactoryContext,
} from 'satteri'
import {
  formatReference,
  readBibliography,
  type Bibliography,
} from '../bibliography'
import { escapeHtml } from '../text'

const KEY = String.raw`[A-Za-z0-9_](?:[A-Za-z0-9_]|[:.#$%&+?<>~/-](?=[A-Za-z0-9_]))*`

const CITE_MARKER_PATTERN = new RegExp(String.raw`(^|[^\w])@(${KEY})`, 'g')
const CITE_GROUP_PATTERN = /\[([^[\]]*@[^[\]]*)\]/g
const CITE_ITEM_PATTERN = new RegExp(
  String.raw`^([\s\S]*?)(-?)@(${KEY})([\s\S]*)$`,
)

interface CitationMarker {
  key: string
  markerStart: number
  markerEnd: number
}

function parseCitationMarkers(value: string): CitationMarker[] {
  const markers: CitationMarker[] = []

  for (const match of value.matchAll(CITE_MARKER_PATTERN)) {
    const prefix = match[1]
    const key = match[2]
    const markerStart = match.index! + prefix.length

    markers.push({
      key,
      markerStart,
      markerEnd: markerStart + key.length + 1,
    })
  }

  return markers
}

export function extractCitedKeys(body: string | undefined): string[] {
  if (!body) return []
  return [...new Set(parseCitationMarkers(body).map(({ key }) => key))]
}

const GROUP_SEPARATOR_PATTERN = /^[\s,;]+$/
const SPACE_BEFORE_PUNCTUATION_PATTERN = /^\s+(?=[.,;:!?)])/

type Context = Parameters<NonNullable<MdastPluginDefinition['paragraph']>>[1]
type Child = { type: string; value?: string }
type Part = { type: 'text' | 'html'; value: string }
type CitationGroup = { keys: string[]; start: number; end: number }

function groupAdjacentCitations(
  value: string,
  markers: CitationMarker[],
): CitationGroup[] {
  const groups: CitationGroup[] = []

  for (const marker of markers) {
    const current = groups[groups.length - 1]
    const separator = current
      ? value.slice(current.end, marker.markerStart)
      : ''

    if (current && GROUP_SEPARATOR_PATTERN.test(separator)) {
      current.keys.push(marker.key)
      current.end = marker.markerEnd
      continue
    }

    groups.push({
      keys: [marker.key],
      start: marker.markerStart,
      end: marker.markerEnd,
    })
  }

  return groups
}

function renderLink(
  key: string,
  number: number,
  bibliography: Bibliography | null,
): string {
  const safeKey = escapeHtml(key)
  const entry = bibliography?.[key]
  if (!entry) {
    return `<span class="citation-missing" title="Citation key not found: ${safeKey}">${safeKey}?</span>`
  }
  const label = escapeHtml(
    `${number}. ${entry.author.join(', ')}, ${entry.year ?? 'n.d.'}. ${entry.title}`,
  )
  const preview = escapeHtml(formatReference(entry))
  return `<a href="#ref-${safeKey}" class="citation-link" aria-label="${label}" data-citation-preview="${preview}">${number}</a>`
}

export const cite =
  (directory: string) =>
  ({ data }: PluginFactoryContext) => {
    const bibName = data.astro?.frontmatter.bib
    if (typeof bibName !== 'string' || !bibName) return null

    const bibliography = readBibliography(directory, bibName)
    const citationNumbers = new Map<string, number>()

    const numberFor = (key: string): number => {
      const existing = citationNumbers.get(key)
      if (existing) return existing
      const next = citationNumbers.size + 1
      citationNumbers.set(key, next)
      return next
    }

    const bracketed = (inner: string): Part[] => {
      const rendered: string[] = []
      for (const item of inner.split(';')) {
        const match = CITE_ITEM_PATTERN.exec(item)
        if (!match) return [{ type: 'text', value: `[${inner}]` }]
        const [, prefix, , key, suffix] = match
        const lead = prefix.trim()
        rendered.push(
          `${lead ? `${escapeHtml(lead)} ` : ''}${renderLink(key, numberFor(key), bibliography)}${escapeHtml(suffix.trimEnd())}`,
        )
      }
      return [
        {
          type: 'html',
          value: `<span class="citation">[${rendered.join('; ')}]</span>`,
        },
      ]
    }

    const narrative = (value: string): Part[] => {
      const parts: Part[] = []
      let cursor = 0

      for (const group of groupAdjacentCitations(
        value,
        parseCitationMarkers(value),
      )) {
        if (group.start > cursor) {
          parts.push({ type: 'text', value: value.slice(cursor, group.start) })
        }

        const links = group.keys.map((key) =>
          renderLink(key, numberFor(key), bibliography),
        )
        parts.push({
          type: 'html',
          value: `<span class="citation">[${links.join(', ')}]</span>`,
        })

        cursor = group.end
        const gap = SPACE_BEFORE_PUNCTUATION_PATTERN.exec(value.slice(cursor))
        if (gap) cursor += gap[0].length
      }

      if (cursor < value.length) {
        parts.push({ type: 'text', value: value.slice(cursor) })
      }
      return parts
    }

    const convert = (value: string): Part[] | null => {
      const parts: Part[] = []
      let cursor = 0
      for (const group of value.matchAll(CITE_GROUP_PATTERN)) {
        parts.push(...narrative(value.slice(cursor, group.index)))
        parts.push(...bracketed(group[1]))
        cursor = group.index + group[0].length
      }
      parts.push(...narrative(value.slice(cursor)))
      return parts.some(({ type }) => type === 'html') ? parts : null
    }

    const rewrite = (
      parent: { children: readonly unknown[] },
      ctx: Context,
    ) => {
      const children = parent.children as readonly Child[]
      let start = 0
      while (start < children.length) {
        if (children[start].type !== 'text') {
          start += 1
          continue
        }
        let end = start
        while (end + 1 < children.length && children[end + 1].type === 'text') {
          end += 1
        }
        const value = children
          .slice(start, end + 1)
          .map((child) => child.value)
          .join('')
        const parts = value.includes('@') ? convert(value) : null
        if (parts) {
          ctx.replaceNode(children[start] as never, parts)
          for (let index = start + 1; index <= end; index += 1) {
            ctx.removeNode(children[index] as never)
          }
        }
        start = end + 1
      }
    }

    return defineMdastPlugin({
      name: 'cite',
      paragraph: rewrite,
      heading: rewrite,
      emphasis: rewrite,
      strong: rewrite,
      tableCell: rewrite,
    })
  }
