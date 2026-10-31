import { existsSync } from "node:fs"
import { glob } from "node:fs/promises"
import { join, sep } from "node:path"

export const posix = (path: string) => path.split(sep).join("/")

export async function* siteHtmlPages(root: string, publicDir: string) {
  for await (const file of glob("**/*.html", { cwd: root })) {
    if (!existsSync(join(publicDir, file))) yield file
  }
}
