import type { AstroIntegration } from 'astro'
import { existsSync, readFileSync } from 'node:fs'

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteHtmlPages } from './html-pages'

const INTERNAL_REFERENCE =
  /\s(?:href|src)="(?!\/\/|[a-z][a-z0-9+.-]*:|#)([^"#?]+)/gi

const decode = (value: string) => {
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}

export const redirectSources = (text: string) =>
  new Set(
    text
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((source) => source && !source.startsWith('#'))
      .map(decode),
  )

export function linkCheck(prebuilt: string[], base: string): AstroIntegration {
  return {
    name: 'link-check',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir)
        const redirectsFile = join(root, '_redirects')
        const redirects = redirectSources(
          existsSync(redirectsFile) ? readFileSync(redirectsFile, 'utf8') : '',
        )
        const exists = (path: string) =>
          [path, `${path}.html`, join(path, 'index.html')].some(existsSync)
        const broken: string[] = []

        for await (const file of siteHtmlPages(root, prebuilt)) {
          const page = join(root, file)
          for (const [, link] of readFileSync(page, 'utf8').matchAll(
            INTERNAL_REFERENCE,
          )) {
            const path = decode(link)
            const inside = !base || path === base || path.startsWith(`${base}/`)
            const target = path.startsWith('/')
              ? join(root, path.slice(base.length))
              : resolve(dirname(page), path)
            const found =
              path.startsWith('/') && !inside ? false : exists(target)
            if (!found && !redirects.has(path)) broken.push(`${file}: ${link}`)
          }
        }

        if (broken.length)
          throw new Error(`Broken links:\n${broken.join('\n')}`)
      },
    },
  }
}
