import type { AstroIntegration } from 'astro'
import { existsSync, readFileSync } from 'node:fs'

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteHtmlPages } from './html-pages'

const INTERNAL_REFERENCE =
  /\s(?:href|src)="(?!\/\/|[a-z][a-z0-9+.-]*:|#)([^"#?]+)/gi

export function linkCheck(prebuilt: string[]): AstroIntegration {
  return {
    name: 'link-check',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir)
        const redirectsFile = join(root, '_redirects')
        const redirects = new Set(
          existsSync(redirectsFile)
            ? readFileSync(redirectsFile, 'utf8')
                .split('\n')
                .map((line) => line.split(/\s+/)[0])
            : [],
        )
        const exists = (path: string) =>
          [path, `${path}.html`, join(path, 'index.html')].some(existsSync)
        const broken: string[] = []

        for await (const file of siteHtmlPages(root, prebuilt)) {
          const page = join(root, file)
          for (const [, link] of readFileSync(page, 'utf8').matchAll(
            INTERNAL_REFERENCE,
          )) {
            const path = decodeURI(link)
            const target = path.startsWith('/')
              ? join(root, path)
              : resolve(dirname(page), path)
            if (!exists(target) && !redirects.has(link))
              broken.push(`${file}: ${link}`)
          }
        }

        if (broken.length)
          throw new Error(`Broken links:\n${broken.join('\n')}`)
      },
    },
  }
}
