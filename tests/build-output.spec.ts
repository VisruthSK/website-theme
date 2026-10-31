import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { withoutTemplates } from "../src/integrations/link-check.ts"
import { PAGE_MARKERS } from "../src/lib/page-styles.ts"
import { baseOf, expect, test, type Site } from "./sites.ts"

const distOf = (site: Site) => join(process.cwd(), site.dir, "dist")

function files(directory: string, extension: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return files(path, extension)
    return entry.name.endsWith(extension) ? [path] : []
  })
}

const assets = (site: Site, extension: string) =>
  readdirSync(join(distOf(site), "_astro"))
    .filter((name) => name.endsWith(extension))
    .map((name) => join(distOf(site), "_astro", name))

const pages = (site: Site) =>
  files(distOf(site), ".html").filter((file) =>
    readFileSync(file, "utf8").includes('<meta name="generator"'),
  )

test("every bundled font is subset to a small file", ({ site }) => {
  const fonts = assets(site, ".woff2")
  expect(fonts.length).toBeGreaterThan(0)
  for (const font of fonts) {
    expect(statSync(font).size, font).toBeLessThan(30_000)
  }
})

test("stylesheets carry only the rules each page uses", ({ site }) => {
  const sheets = new Map(
    assets(site, ".css").map((file) => [file, readFileSync(file, "utf8")]),
  )
  for (const [file, css] of sheets) {
    expect(css, file).not.toMatch(/@feature|@when|\.zw-/)
  }
  for (const file of pages(site)) {
    const html = readFileSync(file, "utf8")
    const linked = [
      ...html.matchAll(/rel="stylesheet" href="[^"]*\/_astro\/([^"]+)"/g),
    ].map(([, name]) => name)
    expect(linked.length, file).toBeGreaterThan(0)
    expect(
      linked.filter((name) => name.startsWith("base.")),
      file,
    ).toHaveLength(1)
    for (const [stem, marker] of Object.entries(PAGE_MARKERS)) {
      expect(
        linked.some((name) => name.startsWith(`${stem}.`)),
        `${file} ${stem}`,
      ).toBe(marker.test(html))
    }
  }
})

test("no page carries an inline script or style", ({ site }) => {
  for (const file of pages(site)) {
    const html = readFileSync(file, "utf8")
    expect(html, file).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>\s*\S/)
    expect(html, file).not.toMatch(/<style[\s>]/)
    expect(html, file).not.toMatch(/\sstyle="/)
  }
})

test("bundled scripts never write the style attribute", ({ site }) => {
  for (const script of assets(site, ".js")) {
    expect(readFileSync(script, "utf8"), script).not.toMatch(
      /setAttribute\(["']style["']/,
    )
  }
})

test("every page declares its colour schemes before any stylesheet", ({
  site,
}) => {
  for (const file of pages(site)) {
    const html = readFileSync(file, "utf8")
    const meta = html.search(/<meta name="?color-scheme"? content="light dark"/)
    const stylesheet = html.search(/<link rel="?stylesheet/)
    expect(meta, file).toBeGreaterThan(-1)
    if (stylesheet !== -1) expect(meta, file).toBeLessThan(stylesheet)
  }
})

test("pages swap instantly with no view transition", ({ site }) => {
  for (const stylesheet of assets(site, ".css")) {
    expect(readFileSync(stylesheet, "utf8"), stylesheet).not.toContain(
      "view-transition",
    )
  }
})

test("every internal link and anchor resolves", ({ site }) => {
  const dist = distOf(site)
  const broken: string[] = []
  const ids = new Map<string, Set<string>>()
  const idsOf = (file: string) => {
    if (!ids.has(file)) {
      const html = readFileSync(file, "utf8")
      ids.set(
        file,
        new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id)),
      )
    }
    return ids.get(file)!
  }
  const root = baseOf(site)
  const target = (from: string, path: string) => {
    if (path.startsWith("/") && root && !`${path}/`.startsWith(`${root}/`)) {
      return undefined
    }
    const base = path.startsWith("/")
      ? join(dist, decodeURI(path.slice(root.length)))
      : join(dirname(from), decodeURI(path))
    return [base, `${base}.html`, join(base, "index.html")].find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    )
  }
  for (const file of pages(site)) {
    const html = withoutTemplates(readFileSync(file, "utf8"))
    for (const [, link] of html.matchAll(
      /\s(?:href|src)="(?!\/\/|[a-z][a-z0-9+.-]*:)([^"?]*)"/gi,
    )) {
      const [path, hash] = link.split("#")
      const page = path ? target(file, path) : file
      if (!page) broken.push(`${file}: ${link}`)
      else if (
        hash &&
        page.endsWith(".html") &&
        !idsOf(page).has(decodeURIComponent(hash))
      )
        broken.push(`${file}: ${link}`)
    }
  }
  expect(broken).toEqual([])
})

const feeds = (site: Site) => [
  "rss.xml",
  ...site.theme.sections.map(({ slug }) => `${slug}/rss.xml`),
]

function feedItems(site: Site, path: string): string[] {
  return readFileSync(join(distOf(site), path), "utf8")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .split("<item>")
    .slice(1)
}

test("feeds carry footnotes in the convention feed readers recognise", ({
  site,
}) => {
  let notes = 0
  for (const path of feeds(site)) {
    for (const item of feedItems(site, path)) {
      expect(item).not.toContain("user-content-fn")
      expect(item).not.toContain("<side-note")
      expect(item).not.toContain("data-astro-")
      for (const [, id] of item.matchAll(/href="#(fn(?:ref)?:[^"]+)"/g)) {
        notes += 1
        expect(item, `${path} ${id}`).toContain(`id="${id}"`)
      }
      if (item.includes("data-footnotes")) {
        expect(item).toContain('role="doc-endnotes"')
        expect(item).toContain('role="doc-endnote"')
        expect(item).toContain('role="doc-backlink"')
      }
    }
  }
  expect(notes).toBeGreaterThan(0)
})

test("every citation in a feed has its reference in the same item", ({
  site,
}) => {
  test.skip(!site.theme.features.citations, "citations are switched off")
  let citations = 0
  for (const path of feeds(site)) {
    for (const item of feedItems(site, path)) {
      for (const [, id] of item.matchAll(/href="#(ref-[^"]+)"/g)) {
        citations += 1
        expect(item, `${path} ${id}`).toContain(`id="${id}"`)
      }
    }
  }
  expect(citations).toBeGreaterThan(0)
})

test("posts carry citation meta tags", ({ site }) => {
  const posts = pages(site).filter((file) =>
    readFileSync(file, "utf8").includes("article:published_time"),
  )
  expect(posts.length).toBeGreaterThan(0)
  for (const file of posts) {
    const html = readFileSync(file, "utf8")
    expect(html, file).toContain('name="citation_title"')
    expect(html, file).toContain('name="citation_publication_date"')
  }
})
