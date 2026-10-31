export const PAGE_MARKERS = {
  article: /<prose-content[\s>]/,
  math: /<math[\s>]|<math-display[\s>]/,
  search: /<search-page[\s>]/,
} as const

export type PageStyle = keyof typeof PAGE_MARKERS

export const PAGE_FILES: [RegExp, PageStyle][] = [
  [
    /[\\/]styles[\\/](?:prose|notes|typography-tables|callout)\.css$/,
    "article",
  ],
  [/[\\/]styles[\\/]typography-math\.css$/, "math"],
]

const edge = (name: string, side: "s" | "e") =>
  `.zw-${name}-${side}{--zw-${name}:${side}}`

export const wrapPageStyle = (name: string, css: string) =>
  `${edge(name, "s")}${css}${edge(name, "e")}`

const REGION = /\.zw-([a-z]+)-s\{--zw-\1:s\}([\s\S]*?)\.zw-\1-e\{--zw-\1:e\}/g

interface StylePart {
  name?: PageStyle
  css: string
}

function splitPageStyles(css: string): StylePart[] {
  const parts: StylePart[] = []
  let end = 0
  for (const match of css.matchAll(REGION)) {
    if (match.index > end) parts.push({ css: css.slice(end, match.index) })
    parts.push({ name: match[1] as PageStyle, css: match[2] })
    end = match.index + match[0].length
  }
  if (end < css.length) parts.push({ css: css.slice(end) })
  return parts
}

export interface StyleFile {
  stem: string
  css: string
}

export function arrangeStyles(sheets: string[], html: string): StyleFile[] {
  const before: string[] = []
  const after: string[] = []
  const groups = new Map<string, string>()

  for (const sheet of sheets) {
    const parts = splitPageStyles(sheet)
    if (parts.every(({ name }) => !name)) {
      ;(groups.size ? after : before).push(sheet)
      continue
    }
    for (const { name = "base", css } of parts) {
      groups.set(name, (groups.get(name) ?? "") + css)
    }
  }

  const layout = ["base", ...Object.keys(PAGE_MARKERS)]
    .filter(
      (name) => name === "base" || PAGE_MARKERS[name as PageStyle].test(html),
    )
    .map((stem) => ({ stem, css: groups.get(stem) ?? "" }))
  return [
    { stem: "pre", css: before.join("") },
    ...layout,
    { stem: "route", css: after.join("") },
  ].filter(({ css }) => css)
}
