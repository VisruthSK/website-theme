import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "./sites.ts"

const traces = {
  typeset: [/typeset\.[\w-]+\.js/, /\bdata-j=/],
  citations: [/citation-link/, /\.bibliography/],
  marginNotes: [/<side-note/, /side-note\{/],
  math: [/STIXTwoMath/, /math-display\{/],
  callouts: [/data-callout/],
  dropCap: [/class="drop-cap"/, /\.drop-cap[{,\s]/],
  search: [/pagefind\/pagefind/, /name="pagefind:/],
  externalLinkIcons: [/external-link-icon/],
}

function contents(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory())
        return entry.name === "pagefind" ? [] : [contents(path)]
      return /\.(html|css|js)$/.test(entry.name)
        ? [readFileSync(path, "utf8")]
        : []
    })
    .join("\n")
}

test("switched-off features leave nothing in the build", ({ site }) => {
  const dist = join(process.cwd(), site.dir, "dist")
  const built = contents(dist)
  for (const [feature, patterns] of Object.entries(traces)) {
    const enabled = site.theme.features[feature as keyof typeof traces]
    for (const pattern of patterns) {
      expect(pattern.test(built), `${feature} ${pattern}`).toBe(enabled)
    }
  }
  expect(existsSync(join(dist, "pagefind"))).toBe(site.theme.features.search)
  expect(existsSync(join(dist, "search", "index.html"))).toBe(
    site.theme.features.search,
  )
})
