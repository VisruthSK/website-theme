import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'

const KEY_LENGTH = 20

export const digest = (...parts: (string | Uint8Array)[]) => {
  const hash = createHash('sha256')
  for (const part of parts) hash.update(part)
  return hash.digest('hex').slice(0, KEY_LENGTH)
}

export function buildCache(root: URL, kind: string) {
  const directory = new URL('node_modules/.astro/website-theme/', root)
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
