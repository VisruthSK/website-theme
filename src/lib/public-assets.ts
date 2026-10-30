import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { paths } from 'virtual:erudite/config'

import { withBase } from '@/lib/base'

export async function getPublicAssets(directory: string) {
  const entries = await readdir(join(paths.public, directory), {
    withFileTypes: true,
  }).catch(() => [])
  return entries
    .filter((entry) => entry.isFile())
    .map(({ name }) => ({
      name,
      href: withBase(encodeURI(`/${directory}/${name}`)),
      displayName: name.replace(extname(name), ''),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
}
