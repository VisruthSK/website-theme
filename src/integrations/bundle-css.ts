import type { AstroIntegration } from 'astro'
import { createHash } from 'node:crypto'
import { glob, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { arrangeStyles } from '../lib/page-styles'

const STYLESHEET = /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)">/g

const hash = (text: string) =>
  createHash('sha256').update(text).digest('hex').slice(0, 8)

export function bundleCss(): AstroIntegration {
  return {
    name: 'bundle-css',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir)
        const sources = new Map<string, string>()
        const written = new Set<string>()

        const emit = async (stem: string, css: string) => {
          const name = `/_astro/${stem}.${hash(css)}.css`
          if (!written.has(name)) {
            written.add(name)
            await writeFile(join(root, name), css)
          }
          return name
        }

        for await (const file of glob('**/*.html', { cwd: root })) {
          const page = join(root, file)
          const html = await readFile(page, 'utf8')
          const hrefs = [...html.matchAll(STYLESHEET)].map(([, href]) => href)
          if (!hrefs.length) continue

          const sheets = await Promise.all(
            hrefs.map(async (href) => {
              if (!sources.has(href)) {
                sources.set(href, await readFile(join(root, href), 'utf8'))
              }
              return sources.get(href)!
            }),
          )

          const links = await Promise.all(
            arrangeStyles(sheets, html).map(({ stem, css }) => emit(stem, css)),
          )
          const tags = links
            .map((href) => `<link rel="stylesheet" href="${href}">`)
            .join('')

          let first = true
          await writeFile(
            page,
            html.replace(STYLESHEET, () => {
              if (!first) return ''
              first = false
              return tags
            }),
          )
        }

        await Promise.all(
          [...sources.keys()].map((href) => rm(join(root, href))),
        )
      },
    },
  }
}
