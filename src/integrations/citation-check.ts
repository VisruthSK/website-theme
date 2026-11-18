import type { AstroIntegration } from "astro"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { posix, siteHtmlPages } from "./html-pages"
import { withoutTemplates } from "./link-check"

const MISSING = /data-citation-missing="([^"]*)"/g

const unescape = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")

export function findMissingCitations(
  pages: Iterable<[file: string, html: string]>,
): Map<string, string[]> {
  const missing = new Map<string, string[]>()
  for (const [file, html] of pages) {
    const keys = new Set(
      [...html.matchAll(MISSING)].map(([, raw]) => unescape(raw)),
    )
    for (const key of keys) {
      const files = missing.get(key) ?? []
      files.push(file)
      missing.set(key, files)
    }
  }
  return missing
}

export function citationCheck(publicDir: string): AstroIntegration {
  return {
    name: "citation-check",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir)
        const pages: [string, string][] = []
        for await (const file of siteHtmlPages(root, publicDir)) {
          pages.push([
            posix(file),
            withoutTemplates(readFileSync(join(root, file), "utf8")),
          ])
        }
        const missing = findMissingCitations(pages)
        if (missing.size) {
          const report = [...missing].map(
            ([key, files]) => `@${key} (${files.join(", ")})`,
          )
          throw new Error(
            `Unknown citation keys:\n${report.join("\n")}\nAdd them to src/data/references.bib.`,
          )
        }
      },
    },
  }
}
