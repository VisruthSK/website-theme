import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const [mode, value] = process.argv.slice(2)
if (mode === "configure") {
  if (!/^\d+$/.test(value)) throw new Error("Expected a PR number")
  const file = "examples/full/theme.json"
  const theme = JSON.parse(readFileSync(file, "utf8"))
  theme.site.href = `${theme.site.href.replace(/\/$/, "")}/pr/${value}/`
  writeFileSync(file, JSON.stringify(theme, null, 2))
} else if (mode === "noindex") {
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.name.endsWith(".html")) {
        const html = readFileSync(path, "utf8")
        writeFileSync(
          path,
          html.replace(
            "</head>",
            '<meta name="robots" content="noindex, nofollow"></head>',
          ),
        )
      }
    }
  }
  visit("examples/full/dist")
} else throw new Error("Expected configure or noindex")
