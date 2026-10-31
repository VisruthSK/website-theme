import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const KEY_LENGTH = 20

export const digest = (...parts: (string | Uint8Array)[]) => {
  const hash = createHash("sha256")
  for (const part of parts) hash.update(part)
  return hash.digest("hex").slice(0, KEY_LENGTH)
}

export const shortHash = (text: string) => digest(text).slice(0, 8)

export function buildCache(root: URL, kind: string) {
  const directory = new URL("node_modules/.astro/website-theme/", root)
  const file = (key: string) => new URL(`${kind}-${key}`, directory)
  return {
    read: (key: string) => readFile(file(key)).catch(() => undefined),
    async write(key: string, data: string | Uint8Array) {
      await mkdir(directory, { recursive: true })
      const stale = (await readdir(directory)).filter(
        (name) =>
          name.slice(0, -KEY_LENGTH - 1) === kind && name !== `${kind}-${key}`,
      )
      await Promise.all(
        stale.map((name) => rm(new URL(name, directory), { force: true })),
      )
      await writeFile(file(key), data)
    },
  }
}

export function libraryVersions(...names: string[]) {
  return names.map((name) => {
    let directory = dirname(fileURLToPath(import.meta.resolve(name)))
    for (;;) {
      try {
        const manifest = JSON.parse(
          readFileSync(join(directory, "package.json"), "utf8"),
        )
        if (manifest.name === name) return `${name}@${manifest.version}`
      } catch {}
      const parent = dirname(directory)
      if (parent === directory) throw new Error(`No package.json for ${name}`)
      directory = parent
    }
  })
}
