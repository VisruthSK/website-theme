import { glob } from 'node:fs/promises'
import { sep } from 'node:path'

export const posix = (path: string) => path.split(sep).join('/')

export async function* siteHtmlPages(root: string, prebuilt: string[]) {
  const skipped = prebuilt.map((directory) => `${directory}/`)
  for await (const file of glob('**/*.html', { cwd: root })) {
    if (!skipped.some((prefix) => posix(file).startsWith(prefix))) yield file
  }
}
