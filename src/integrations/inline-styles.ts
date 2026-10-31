import type { AstroIntegration } from "astro"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { shortHash } from "../lib/build-cache"
import { siteHtmlPages } from "./html-pages"

const STYLED_TAG = /<([a-z][a-z0-9-]*)([^<>]*?)\sstyle="([^"]*)"([^<>]*)>/gi
const TOKEN_VARIABLE = /(?:^|;)--([01])(bg|fs|fw|td)?:/g
const TOKEN_PROPERTY: Record<string, string> = {
  "": "color",
  bg: "background-color",
  fs: "font-style",
  fw: "font-weight",
  td: "text-decoration",
}

function themeRules(selector: string, style: string) {
  const themes: string[][] = [[], []]
  for (const [, theme, kind = ""] of style.matchAll(TOKEN_VARIABLE)) {
    themes[Number(theme)].push(`${TOKEN_PROPERTY[kind]}:var(--${theme}${kind})`)
  }
  if (!themes[0].length && !themes[1].length) return ""
  const [light, dark] = themes.map((declarations) => declarations.join(";"))
  return [
    `:root ${selector}{${light}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme=light]) ${selector}{${dark}}}`,
    `:root[data-theme=dark] ${selector}{${dark}}`,
  ].join("\n")
}

export function inlineStyles(
  publicDir: string,
  base: string,
): AstroIntegration {
  return {
    name: "inline-styles-to-classes",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir)
        const rules = new Map<string, string>()
        const pages = new Map<string, string>()

        for await (const file of siteHtmlPages(root, publicDir)) {
          const html = await readFile(join(root, file), "utf8")
          const rewritten = html.replace(
            STYLED_TAG,
            (_, tag, before, style, after) => {
              const name = `s${shortHash(style)}`
              rules.set(name, style)
              const attributes = before + after
              return /\sclass="/.test(attributes)
                ? `<${tag}${attributes.replace(/\sclass="([^"]*)"/, ` class="$1 ${name}"`)}>`
                : `<${tag} class="${name}"${attributes}>`
            },
          )
          if (rewritten !== html) pages.set(file, rewritten)
        }

        if (!pages.size) return

        const css = [...rules]
          .map(
            ([name, style]) =>
              `.${name}{${style}}\n${themeRules(`.${name}`, style)}`,
          )
          .join("\n")
        const name = `/_astro/inline-styles.${shortHash(css)}.css`
        const href = `${base}${name}`
        await writeFile(join(root, name), css)

        const link = `<link rel="stylesheet" href="${href}">`
        for (const [file, html] of pages) {
          await writeFile(
            join(root, file),
            html.replace("</head>", `${link}</head>`),
          )
        }
      },
    },
  }
}
