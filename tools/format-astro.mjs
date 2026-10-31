import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { format } from "prettier"

const frontmatterOptions = {
  parser: "typescript",
  semi: false,
  singleQuote: false,
}
const stringLiteral = /(?<![\p{L}\p{N}])'([^'"\\\n]*)'(?![\p{L}\p{N}])/gu
const styleBlock = /(<style[\s\S]*?<\/style>)|([^]*?)(?=<style|$)/g

async function formatted(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  const head = match
    ? `---\n${(await format(match[1], frontmatterOptions)).trimEnd()}\n---\n`
    : ""
  const template = match ? text.slice(match[0].length) : text
  const body = template
    .replace(/<style[\s\S]*?<\/style>/g, (block) =>
      block.replace(/'([^'"\n]*)'/g, '"$1"'),
    )
    .replace(styleBlock, (_, style, other) =>
      style ? style : other.replace(stringLiteral, '"$1"'),
    )
  return head + body
}

const write = process.argv.includes("--write")
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "*.astro"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)

const stale = []
for (const file of files) {
  const text = readFileSync(file, "utf8")
  const next = await formatted(text)
  if (next === text) continue
  stale.push(file)
  if (write) writeFileSync(file, next)
}

if (stale.length && !write) {
  console.error(
    `These Astro files use single quotes or unformatted frontmatter:\n${stale.join("\n")}\nRun: node scripts/format-astro.mjs --write`,
  )
  process.exit(1)
}
console.log(
  write
    ? `Formatted ${stale.length} Astro files.`
    : `${files.length} Astro files are formatted.`,
)
