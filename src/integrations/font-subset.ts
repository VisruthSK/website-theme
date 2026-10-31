import type { AstroIntegration } from "astro"
import { subset } from "@web-alchemy/fonttools"
import { decodeHTML } from "entities"
import { existsSync } from "node:fs"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { basename, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import type { Theme } from "../../config/theme"
import { buildCache, digest, libraryVersions } from "../lib/build-cache"
import { posix } from "./html-pages"

const BUNDLE_REFERENCE = "_astro/"

const KEPT_LAYOUT_FEATURES = "pnum,smcp,c2sc,tnum"

const stem = (file: string) => file.replace(/\.[^.]+$/, "")

const builtStem = (path: string) =>
  basename(path).replace(/\.[^.]+\.woff2$/, "")

async function walk(dir: string, onFile: (path: string) => Promise<void>) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path, onFile)
    else if (entry.isFile()) await onFile(path)
  }
}

function addWithCaseVariants(chars: Set<string>, source: string) {
  for (const char of source) {
    chars.add(char)
    const upper = char.toUpperCase()
    const lower = char.toLowerCase()
    if (upper.length === 1) chars.add(upper)
    if (lower.length === 1) chars.add(lower)
  }
}

function addText(chars: Set<string>, source: string) {
  for (const char of source) chars.add(char)
}

function textInTags(html: string, tags: string) {
  return Array.from(
    html.matchAll(
      new RegExp(
        `<(?:${tags})(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:${tags})>`,
        "gi",
      ),
    ),
    ([, text]) => text.replace(/<[^>]+>/g, ""),
  ).join("")
}

export function fontSubset(theme: Theme, root: URL): AstroIntegration {
  const { body, heading, mono, dropCap } = theme.fonts
  const shared = new Set(
    [
      ...heading.faces,
      ...(mono?.faces ?? []),
      ...(dropCap ? [dropCap] : []),
    ].map(({ file }) => stem(file)),
  )
  const only = (keep: (face: (typeof body.faces)[number]) => boolean) =>
    body.faces
      .filter(keep)
      .map(({ file }) => stem(file))
      .filter((name) => !shared.has(name))
  const boldStems = only(({ weight }) => weight >= 600)
  const italicStems = only(({ style }) => style === "italic")
  const publicDir = fileURLToPath(new URL("public/", root))

  return {
    name: "font-subset",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outputPath = fileURLToPath(dir)
        const bundledFonts = join(outputPath, "_astro")
        const chars = new Set<string>()
        const boldChars = new Set<string>()
        const italicChars = new Set<string>()

        await walk(outputPath, async (path) => {
          const file = posix(relative(outputPath, path))
          if (existsSync(join(publicDir, file))) return
          if (path.endsWith(".html")) {
            const html = await readFile(path, "utf8")
            if (html.includes(BUNDLE_REFERENCE)) {
              addWithCaseVariants(chars, decodeHTML(html))
              addText(boldChars, decodeHTML(textInTags(html, "strong|b")))
              addText(italicChars, decodeHTML(textInTags(html, "em|i")))
            }
            return
          }
          if (path.startsWith(bundledFonts) && /\.(css|js)$/.test(path)) {
            addWithCaseVariants(chars, await readFile(path, "utf8"))
          }
        })

        const text = Array.from(chars).join("")
        const fonts: string[] = []
        await walk(bundledFonts, async (path) => {
          if (path.endsWith(".woff2")) fonts.push(path)
        })

        const results = await Promise.all(
          fonts.map(async (path) => {
            const original = await readFile(path)
            const fontStem = builtStem(path)
            const fontText = boldStems.includes(fontStem)
              ? Array.from(boldChars).join("")
              : italicStems.includes(fontStem)
                ? Array.from(italicChars).join("")
                : text
            const key = digest(
              original,
              fontText,
              KEPT_LAYOUT_FEATURES,
              String(theme.fonts.stripHinting),
              ...libraryVersions("@web-alchemy/fonttools"),
            )
            const cache = buildCache(root, `subset-${fontStem}`)
            const stored = await cache.read(key)
            const result =
              stored ??
              (await subset(original, {
                text: fontText,
                flavor: "woff2",
                ...(theme.fonts.stripHinting ? { "no-hinting": true } : {}),
                "layout-features+": KEPT_LAYOUT_FEATURES,
              }))
            if (!stored) await cache.write(key, result)
            if (result.length >= original.length) return undefined
            await writeFile(path, result)
            return { before: original.length, after: result.length }
          }),
        )
        const done = results.filter((entry) => entry !== undefined)
        const before = done.reduce((sum, entry) => sum + entry.before, 0)
        const after = done.reduce((sum, entry) => sum + entry.after, 0)
        const count = done.length

        logger.info(
          count
            ? `Subset ${count} fonts to ${chars.size} glyphs: ${Math.round(before / 1024)}K to ${Math.round(after / 1024)}K (${Math.round(((before - after) / before) * 100)}% smaller).`
            : "No font became smaller by subsetting.",
        )
      },
    },
  }
}
