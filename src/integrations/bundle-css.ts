import type { AstroIntegration } from 'astro'
import { createHash } from 'node:crypto'
import { glob, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STYLESHEET = /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)">/g

export function bundleCss(): AstroIntegration {
  return {
    name: 'bundle-css',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir)
        const sources = new Map<string, string>()
        const bundles = new Map<string, string>()

        for await (const file of glob('**/*.html', { cwd: root })) {
          const page = join(root, file)
          const html = await readFile(page, 'utf8')
          const hrefs = [...html.matchAll(STYLESHEET)].map(([, href]) => href)
          if (hrefs.length < 2) continue

          const key = hrefs.join()
          if (!bundles.has(key)) {
            const css = (
              await Promise.all(
                hrefs.map(async (href) => {
                  if (!sources.has(href)) {
                    sources.set(href, await readFile(join(root, href), 'utf8'))
                  }
                  return sources.get(href)
                }),
              )
            ).join('\n')
            const name = `/_astro/page.${createHash('sha256').update(css).digest('hex').slice(0, 8)}.css`
            await writeFile(join(root, name), css)
            bundles.set(key, name)
          }

          let first = true
          const rewritten = html.replace(STYLESHEET, () => {
            if (!first) return ''
            first = false
            return `<link rel="stylesheet" href="${bundles.get(key)}">`
          })
          await writeFile(page, rewritten)
        }
      },
    },
  }
}
