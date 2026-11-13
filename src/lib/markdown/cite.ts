import { defineMdastPlugin, type MdastPluginDefinition } from "satteri"
import {
  formatReference,
  formatShortAuthors,
  readBibliography,
  type Bibliography,
  type CitationStyle,
} from "../bibliography"
import { escapeHtml } from "../text"

const KEY = String.raw`[A-Za-z0-9_](?:[A-Za-z0-9_]|[:.#$%&+?<>~/-](?=[A-Za-z0-9_]))*`

const CITE_MARKER_PATTERN = new RegExp(String.raw`(^|[^\w])@(${KEY})`, "g")
const CITE_GROUP_PATTERN = /\[([^[\]]*@[^[\]]*)\]/g
const CITE_ITEM_PATTERN = new RegExp(
  String.raw`^([\s\S]*?)(-?)@(${KEY})([\s\S]*)$`,
)

// Citations are a prose feature; code and HTML comments are ignored.
export function stripCode(markdown: string): string {
  return markdown
    .replace(/\r?\n(```|~~~)[\s\S]*?\n\1(?=\r?\n|$)/g, "\n")
    .replace(/`[^`\n]*`/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
}

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
  return [
    ...new Set(
      parseCitationMarkers(stripCode(body)).map(({ key }) => key),
    ),
  ]
}

const GROUP_SEPARATOR_PATTERN = /^[\s,;]+$/
const SPACE_BEFORE_PUNCTUATION_PATTERN = /^\s+(?=[.,;:!?)])/

type Context = Parameters<NonNullable<MdastPluginDefinition["paragraph"]>>[1]
type Child = { type: string; value?: string }
type Part = { type: "text" | "html"; value: string }
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
      : ""

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
  style: CitationStyle,
  suppressed = false,
): string {
  const safeKey = escapeHtml(key)
  const entry = bibliography?.[key]
  if (!entry) {
    return `<span class="citation-missing" data-citation-missing="${safeKey}" title="Citation key not found: ${safeKey}">${safeKey}?</span>`
  }
  const label = escapeHtml(
    `${number}. ${entry.author.join(", ")}, ${entry.year ?? "n.d."}. ${entry.title}`,
  )
  const preview = escapeHtml(formatReference(entry))
  if (style === "author-year") {
    const year = `${entry.year ?? "n.d."}`
    const text = suppressed
      ? year
      : `${formatShortAuthors(entry.author)} ${year}`
    return `<a href="#ref-${safeKey}" class="citation-link" aria-label="${label}" data-citation-preview="${preview}">${escapeHtml(text)}</a>`
  }
  return `<a href="#ref-${safeKey}" class="citation-link" aria-label="${label}" data-citation-preview="${preview}">${number}</a>`
}

export const cite =
  (file: string, style: CitationStyle = "numeric") =>
  () => {
    const bibliography = readBibliography(file)
    const authorYear = style === "author-year"
    const [open, close] = authorYear ? ["(", ")"] : ["[", "]"]
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
      for (const item of inner.split(";")) {
        const match = CITE_ITEM_PATTERN.exec(item)
        if (!match) return [{ type: "text", value: `[${inner}]` }]
        const [, prefix, dash, key, suffix] = match
        const lead = prefix.trim()
        const suppressed = dash === "-"
        rendered.push(
          `${lead ? `${escapeHtml(lead)} ` : ""}${renderLink(key, numberFor(key), bibliography, style, suppressed)}${escapeHtml(suffix.trimEnd())}`,
        )
      }
      return [
        {
          type: "html",
          value: `<span class="citation">${open}${rendered.join("; ")}${close}</span>`,
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
          parts.push({ type: "text", value: value.slice(cursor, group.start) })
        }

        if (authorYear) {
          const rendered = group.keys.map((key) => {
            const entry = bibliography?.[key]
            const year = `${entry?.year ?? "n.d."}`
            return `${renderLink(key, numberFor(key), bibliography, style)} <span class="citation">(${escapeHtml(year)})</span>`
          })
          parts.push({ type: "html", value: rendered.join(", ") })
        } else {
          const links = group.keys.map((key) =>
            renderLink(key, numberFor(key), bibliography, style),
          )
          parts.push({
            type: "html",
            value: `<span class="citation">${open}${links.join(", ")}${close}</span>`,
          })
        }

        cursor = group.end
        const gap = SPACE_BEFORE_PUNCTUATION_PATTERN.exec(value.slice(cursor))
        if (gap) cursor += gap[0].length
      }

      if (cursor < value.length) {
        parts.push({ type: "text", value: value.slice(cursor) })
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
      return parts.some(({ type }) => type === "html") ? parts : null
    }

    const rewrite = (
      parent: { children: readonly unknown[] },
      ctx: Context,
    ) => {
      const children = parent.children as readonly Child[]
      let start = 0
      while (start < children.length) {
        if (children[start].type !== "text") {
          start += 1
          continue
        }
        let end = start
        while (end + 1 < children.length && children[end + 1].type === "text") {
          end += 1
        }
        const value = children
          .slice(start, end + 1)
          .map((child) => child.value)
          .join("")
        const parts = value.includes("@") ? convert(value) : null
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
      name: "cite",
      paragraph: rewrite,
      heading: rewrite,
      emphasis: rewrite,
      strong: rewrite,
      tableCell: rewrite,
    })
  }
