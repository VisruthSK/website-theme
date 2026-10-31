import { fromHtml } from "hast-util-from-html"
import { selectAll } from "hast-util-select"

export const normalize = (path: string) =>
  decodeURI(path).replace(/\/+$/, "") || "/"

export function linkedPaths(html: string, href: string, origin: string) {
  const paths = new Set<string>()
  for (const link of selectAll("a[href]", fromHtml(html, { fragment: true }))) {
    const value = link.properties.href
    if (typeof value !== "string") continue
    try {
      const url = new URL(value, new URL(href, origin))
      if (url.origin === origin) paths.add(normalize(url.pathname))
    } catch {
      // Ignore malformed links.
    }
  }
  return paths
}
