import { rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const roots = process.argv.slice(2)

for (const root of roots) {
  for (const cache of ['node_modules/.astro/data-store.json', '.astro']) {
    rmSync(`${root}/${cache}`, { recursive: true, force: true })
  }
  const { status } = spawnSync(
    'pnpm',
    ['exec', 'astro', 'build', '--root', root],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )
  if (status !== 0) process.exit(status ?? 1)
}
