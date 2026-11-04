import type { AstroIntegration } from "astro"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import {
  documentUri,
  parseFeed,
  publicationParts,
} from "../../scripts/standard-site.mjs"

export function standardSite(site: string): AstroIntegration {
  return {
    name: "standard-site",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const publication = process.env.STANDARD_SITE_PUBLICATION
        if (!publication) return
        publicationParts(publication)
        const root = fileURLToPath(dir)
        const { records } = parseFeed(
          readFileSync(join(root, "rss.xml"), "utf8"),
          site,
          publication,
        )
        const basePath = new URL(site).pathname.replace(/\/$/, "")
        for (const { url, key } of records) {
          const path = decodeURIComponent(
            new URL(url).pathname.slice(basePath.length),
          ).replace(/^\/+/, "")
          const page = resolve(root, path, "index.html")
          if (!page.startsWith(resolve(root) + sep) || !existsSync(page))
            throw new Error(`Missing RSS page: ${url}`)
          const html = readFileSync(page, "utf8")
          if (!html.includes("</head>"))
            throw new Error(`Missing HTML head: ${url}`)
          writeFileSync(
            page,
            html.replace(
              "</head>",
              `<link rel="site.standard.document" href="${documentUri(publication, key)}"></head>`,
            ),
          )
        }
        const verification = join(
          root,
          ".well-known",
          "site.standard.publication",
          basePath,
        )
        mkdirSync(dirname(verification), { recursive: true })
        writeFileSync(verification, publication)
        const home = join(root, "index.html")
        const html = readFileSync(home, "utf8")
        writeFileSync(
          home,
          html.replace(
            "</head>",
            `<link rel="site.standard.publication" href="${publication}"></head>`,
          ),
        )
      },
    },
  }
}
