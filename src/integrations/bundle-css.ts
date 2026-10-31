import type { AstroIntegration } from "astro"
import { glob, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { shortHash } from "../lib/build-cache"
import { arrangeStyles } from "../lib/page-styles"

export function bundleCss(base: string): AstroIntegration {
  const stylesheet = new RegExp(
    `<link rel="stylesheet" href="(${RegExp.escape(base)}/_astro/[^"]+\\.css)">`,
    "g",
  )
  return {
    name: "bundle-css",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir)
        const sources = new Map<string, string>()
        const written = new Set<string>()
        const fileOf = (href: string) => join(root, href.slice(base.length))

        const emit = async (stem: string, css: string) => {
          const href = `${base}/_astro/${stem}.${shortHash(css)}.css`
          if (!written.has(href)) {
            written.add(href)
            await writeFile(fileOf(href), css)
          }
          return href
        }

        for await (const file of glob("**/*.html", { cwd: root })) {
          const page = join(root, file)
          const html = await readFile(page, "utf8")
          const hrefs = [...html.matchAll(stylesheet)].map(([, href]) => href)
          if (!hrefs.length) continue

          const sheets = await Promise.all(
            hrefs.map(async (href) => {
              if (!sources.has(href)) {
                sources.set(href, await readFile(fileOf(href), "utf8"))
              }
              return sources.get(href)!
            }),
          )

          const links = await Promise.all(
            arrangeStyles(sheets, html).map(({ stem, css }) => emit(stem, css)),
          )
          const tags = links
            .map((href) => `<link rel="stylesheet" href="${href}">`)
            .join("")

          let first = true
          await writeFile(
            page,
            html.replace(stylesheet, () => {
              if (!first) return ""
              first = false
              return tags
            }),
          )
        }

        await Promise.all([...sources.keys()].map((href) => rm(fileOf(href))))
      },
    },
  }
}
