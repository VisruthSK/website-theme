import { glob } from 'node:fs/promises'
import { sep } from 'node:path'

export async function* siteHtmlPages(root: string, prebuilt: string[]) {
  const skipped = prebuilt.flatMap((directory) => [
    `${directory}/`,
    `${directory}${sep}`,
  ])
  for await (const file of glob('**/*.html', { cwd: root })) {
    if (!skipped.some((prefix) => file.startsWith(prefix))) yield file
  }
}
