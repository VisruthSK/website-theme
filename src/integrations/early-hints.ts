import type { AstroIntegration } from "astro"
import { appendFile, glob, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Theme } from "../../config/theme"
export const TYPESET_SCRIPT =
  /<script[^>]*\ssrc="?([^"\s>]*\/_astro\/typeset\.[^"\s>]+\.js)/

function attribute(tag: string, name: string) {
  return new RegExp(`\\s${name}=(?:"([^"]*)"|([^\\s>]+))`)
    .exec(tag)
    ?.slice(1)
    .find(Boolean)
}

function hintsIn(html: string, base: string) {
  return [...html.matchAll(/<link\b[^>]*>/g)].flatMap(([tag]) => {
    const href = attribute(tag, "href")
    const rel = attribute(tag, "rel")
    if (!href?.startsWith(`${base}/_astro/`)) return []
    if (rel === "stylesheet") return [`<${href}>; rel=preload; as=style`]
    if (rel === "preload" && attribute(tag, "as") === "font") {
      return [
        `<${href}>; rel=preload; as=font; type=${attribute(tag, "type")}; crossorigin`,
      ]
    }
    return []
  })
}

async function typesetSections(outputPath: string) {
  let script = ""
  const sections = new Set<string>()
  for await (const file of glob("*/**/index.html", { cwd: outputPath })) {
    const found = TYPESET_SCRIPT.exec(
      await readFile(join(outputPath, file), "utf8"),
    )
    if (!found) continue
    script = found[1]
    sections.add(file.split(/[\\/]/)[0])
  }
  return { script, sections: [...sections].sort() }
}

export function earlyHints(theme: Theme, base: string): AstroIntegration {
  const templatePages = [
    "index.html",
    ...theme.sections.map(({ slug }) => `${slug}/index.html`),
    ...(theme.features.search ? ["search/index.html"] : []),
  ]
  return {
    name: "early-hints",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const outputPath = fileURLToPath(dir)
        const perPage = await Promise.all(
          templatePages.map(async (page) =>
            hintsIn(await readFile(join(outputPath, page), "utf8"), base),
          ),
        )
        const shared = perPage[0].filter((hint) =>
          perPage.every((hints) => hints.includes(hint)),
        )
        const { script, sections } = await typesetSections(outputPath)

        const rules = [
          "/*",
          ...shared.map((hint) => `  Link: ${hint}`),
          ...theme.unhinted.flatMap((path) => ["", path, "  ! Link"]),
          ...sections.flatMap((section) => [
            "",
            `/${section}/*`,
            `  Link: <${script}>; rel=preload; as=script`,
          ]),
        ]
        await appendFile(
          join(outputPath, "_headers"),
          `\n${rules.join("\n")}\n`,
        )
      },
    },
  }
}
