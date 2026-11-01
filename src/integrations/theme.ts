import { satteri } from "@astrojs/markdown-satteri"
import sitemap from "@astrojs/sitemap"
import type { AstroIntegration, AstroUserConfig } from "astro"
import { mergeConfig } from "astro/config"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { satteriValidateLinks } from "satteri-validate-links"

import { loadTheme, type Theme } from "../../config/theme"
import { cite } from "../lib/markdown/cite"
import { baseLinks } from "../lib/markdown/base-links"
import { code } from "../lib/markdown/code"
import { dashes } from "../lib/markdown/dashes"
import { externalLinks } from "../lib/markdown/external-links"
import { footnoteSentences } from "../lib/markdown/footnote-sentences"
import { footnotes } from "../lib/markdown/footnotes"
import { opening } from "../lib/markdown/opening"
import {
  calloutDirective,
  headingAnchors,
  inlineExpressiveCode,
  temmlMath,
} from "../lib/markdown/astro-erudite"
import { localHeadersPlugin } from "../lib/local-headers"
import { bundleCss } from "./bundle-css"
import { earlyHints } from "./early-hints"
import { fontSubset } from "./font-subset"
import { generatedAssets } from "./generated-assets"
import { inlineStyles } from "./inline-styles"
import { linkCheck } from "./link-check"
import { pagefindSearch } from "./pagefind"
import { themeCss } from "./theme-css"
import { typeset } from "./typeset"

const THEME_PAGES = new URL("../pages/", import.meta.url)
const THEME_ICONS = new URL("../icons/", import.meta.url)

const ROUTES: [
  pattern: string,
  file: string,
  feature?: keyof Theme["features"],
][] = [
  ["/", "index.astro"],
  ["/404", "404.astro"],
  ["/recent", "recent.astro"],
  ["/search", "search.astro", "search"],
  ["/[page]", "[page].astro"],
  ["/[collection]", "[collection]/index.astro"],
  ["/[collection]/[...id]", "[collection]/[...id].astro"],
  ["/[collection]/rss.xml", "[collection]/rss.xml.ts"],
  ["/[collection]/index.xml", "[collection]/index.xml.ts"],
  ["/tags", "tags/index.astro"],
  ["/tags/[...id]", "tags/[...id].astro"],
  ["/tags/[tag]/rss.xml", "tags/[tag]/rss.xml.ts"],
  ["/tags/[tag]/index.xml", "tags/[tag]/index.xml.ts"],
  ["/rss.xml", "rss.xml.ts"],
  ["/index.xml", "index.xml.ts"],
  ["/robots.txt", "robots.txt.ts"],
  ["/site.webmanifest", "site.webmanifest.ts"],
]

const isAbsoluteOrExternal = (url: string) =>
  /^(\/|[a-z][a-z0-9+.-]*:)/i.test(url)

function routes(theme: Theme): AstroIntegration {
  return {
    name: "theme-routes",
    hooks: {
      "astro:config:setup": ({ config, injectRoute }) => {
        for (const [pattern, file, feature] of ROUTES) {
          if (feature && !theme.features[feature]) continue
          if (existsSync(new URL(`pages/${file}`, config.srcDir))) continue
          injectRoute({
            pattern,
            entrypoint: fileURLToPath(new URL(file, THEME_PAGES)),
          })
        }
      },
    },
  }
}

function iconPath(name: string, srcDir: URL) {
  const known = [new URL("icons/", srcDir), THEME_ICONS].some((directory) =>
    existsSync(new URL(`${name}.svg`, directory)),
  )
  if (!known) throw new Error(`theme.json names an unknown icon: ${name}`)
  return `@/icons/${name}.svg`
}

function virtualModules(
  theme: Theme,
  root: URL,
  paths: { bibliographies: string; public: string },
) {
  const srcDir = new URL("src/", root)
  const fontUrl = (file: string) =>
    JSON.stringify(`/${theme.fonts.directory}/${file}?url&no-inline`)
  const { body, heading, mono, dropCap } = theme.fonts
  const face = (weight: number, style: string) =>
    body.faces.find((entry) => entry.weight === weight && entry.style === style)
  const fonts: Record<string, string | undefined> = {
    body: (face(400, "normal") ?? body.faces[0]).file,
    bodyItalic: face(400, "italic")?.file,
    heading: heading.faces[0].file,
    mono: mono?.faces[0].file,
    dropCap: theme.features.dropCap ? dropCap?.file : undefined,
    math: theme.features.math ? theme.fonts.math?.file : undefined,
  }
  const present = Object.entries(fonts).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  )
  const bundledMath = theme.features.math && !theme.fonts.math
  const fontNames = [
    ...present.map(([name]) => name),
    ...(bundledMath ? ["math"] : []),
  ]
  const icons = [...new Set(theme.footer.links.map(({ icon }) => icon))]
  const modules: Record<string, string> = {
    "virtual:theme/config": [
      `export default ${JSON.stringify(theme)}`,
      `export const paths = ${JSON.stringify(paths)}`,
    ].join("\n"),
    "virtual:theme/assets": [
      ...present.map(([name, file]) => `import ${name} from ${fontUrl(file)}`),
      ...(bundledMath
        ? [
            "import math from '@/assets/fonts/STIXTwoMath-Regular.woff2?url&no-inline'",
          ]
        : []),
      ...icons.map(
        (name, index) =>
          `import icon${index} from ${JSON.stringify(iconPath(name, srcDir))}`,
      ),
      ...(theme.features.typeset
        ? ["import typesetScript from '@/generated/typeset.js?url&no-inline'"]
        : ["const typesetScript = undefined"]),
      "export { typesetScript }",
      `export const fonts = { ${fontNames.join(", ")} }`,
      `export const icons = { ${icons.map((name, index) => `${JSON.stringify(name)}: icon${index}`).join(", ")} }`,
    ].join("\n"),
  }
  return {
    name: "theme-virtual-modules",
    resolveId: (id: string) => (id in modules ? `\0${id}` : undefined),
    load: (id: string) =>
      id.startsWith("\0") ? modules[id.slice(1)] : undefined,
  }
}

export async function themeConfig(
  root: URL,
  overrides: AstroUserConfig = {},
): Promise<AstroUserConfig> {
  const theme = await loadTheme(new URL("theme.json", root))
  const paths = {
    bibliographies: fileURLToPath(new URL(theme.bibliographies, root)),
    public: fileURLToPath(new URL("public/", root)),
  }
  const { features } = theme
  const { origin, pathname } = new URL(theme.site.href)
  const base = pathname.replace(/\/$/, "")
  const localCsp = ["1", "true", "yes"].includes(
    (process.env.LOCAL_CSP ?? "").toLowerCase(),
  )
  const compress = (await import("@playform/compress")).default

  const config: AstroUserConfig = {
    site: origin,
    ...(base ? { base } : {}),
    compressHTML: true,
    image: {
      layout: "constrained",
      responsiveStyles: false,
      breakpoints: [480, 720, 960, 1280, 1600, 2000],
    },
    build: {
      inlineStylesheets: "never",
    },
    integrations: [
      routes(theme),
      generatedAssets(theme),
      inlineStyles(paths.public, base),
      bundleCss(base),
      sitemap(),
      ...(features.search ? [pagefindSearch()] : []),
      linkCheck(paths.public, base),
      earlyHints(theme, base),
      ...(features.typeset ? [typeset(theme, root)] : []),
      fontSubset(theme, root),
      compress({
        CSS: false,
        HTML: false,
        Image: false,
        JavaScript: true,
        JSON: true,
        SVG: false,
      }),
    ],
    vite: {
      build: {
        assetsInlineLimit: 0,
      },
      plugins: [
        virtualModules(theme, root, paths),
        themeCss(theme),
        ...(localCsp ? [localHeadersPlugin(root)] : []),
      ],
    },
    markdown: {
      syntaxHighlight: false,
      processor: satteri({
        features: {
          directive: features.callouts,
          math: features.math,
          smartPunctuation: { dashes: false },
        },
        mdastPlugins: [
          satteriValidateLinks({
            key: "brokenLinks",
            intoAstroFrontmatter: true,
            ignore: isAbsoluteOrExternal,
          }),
          dashes,
          ...(features.callouts ? [calloutDirective] : []),
          inlineExpressiveCode,
          ...(features.citations ? [cite(paths.bibliographies)] : []),
          ...(features.marginNotes ? [footnoteSentences] : []),
          ...(features.math ? [temmlMath] : []),
        ],
        hastPlugins: [
          externalLinks(theme.site.href, features.externalLinkIcons),
          ...(base ? [baseLinks(base)] : []),
          headingAnchors,
          opening(features.dropCap, theme.prose.dropCapMinWords),
          footnotes(features.marginNotes),
          code,
        ],
      }),
    },
  }
  return mergeConfig(config, overrides)
}
