import type { AstroIntegration } from "astro"
import { existsSync, readFileSync, statSync } from "node:fs"

import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { siteHtmlPages } from "./html-pages"

const INTERNAL_REFERENCE =
  /\s(?:href|src)="(?!\/\/|[a-z][a-z0-9+.-]*:)([^"#?]*)[^"#]*(?:#([^"]*))?"/gi

export const withoutTemplates = (html: string) =>
  html.replace(/<template[\s\S]*?<\/template>/g, "")

const decode = (value: string) => {
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}

export const redirectSources = (text: string) =>
  new Set(
    text
      .split("\n")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((source) => source && !source.startsWith("#"))
      .map(decode),
  )

export function linkCheck(publicDir: string, base: string): AstroIntegration {
  return {
    name: "link-check",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir)
        const redirectsFile = join(root, "_redirects")
        const redirects = redirectSources(
          existsSync(redirectsFile) ? readFileSync(redirectsFile, "utf8") : "",
        )
        const find = (path: string) =>
          [path, `${path}.html`, join(path, "index.html")].find(
            (candidate) =>
              existsSync(candidate) && statSync(candidate).isFile(),
          )
        const ids = new Map<string, Set<string>>()
        const hasId = (file: string, id: string) => {
          if (!ids.has(file)) {
            const html = readFileSync(file, "utf8")
            ids.set(
              file,
              new Set(
                [...html.matchAll(/\sid="([^"]*)"/g)].map(([, id]) => id),
              ),
            )
          }
          return ids.get(file)!.has(id)
        }
        const broken: string[] = []

        for await (const file of siteHtmlPages(root, publicDir)) {
          const page = join(root, file)
          const html = withoutTemplates(readFileSync(page, "utf8"))
          for (const [, link, fragment] of html.matchAll(INTERNAL_REFERENCE)) {
            const path = decode(link)
            const inside = !base || path === base || path.startsWith(`${base}/`)
            const target = !path
              ? page
              : path.startsWith("/")
                ? join(root, path.slice(base.length))
                : resolve(dirname(page), path)
            const found =
              path.startsWith("/") && !inside ? undefined : find(target)
            const missing = found
              ? fragment &&
                !fragment.startsWith("/") &&
                found.endsWith(".html") &&
                !hasId(found, decode(fragment))
              : !redirects.has(path)
            if (missing)
              broken.push(`${file}: ${link}${fragment ? `#${fragment}` : ""}`)
          }
        }

        if (broken.length)
          throw new Error(`Broken links:\n${broken.join("\n")}`)
      },
    },
  }
}
