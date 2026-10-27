import type { AstroIntegration } from 'astro'
import { subset } from '@web-alchemy/fonttools'
import { decodeHTML } from 'entities'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Theme } from '../../config/theme'

const BUNDLE_REFERENCE = '_astro/'

const KEPT_LAYOUT_FEATURES = 'pnum,smcp,c2sc,tnum'

const stem = (file: string) => file.replace(/\.[^.]+$/, '')

const builtStem = (path: string) =>
  basename(path).replace(/\.[^.]+\.woff2$/, '')

async function walk(dir: string, onFile: (path: string) => Promise<void>) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path, onFile)
    else if (entry.isFile()) await onFile(path)
  }
}

function addWithCaseVariants(chars: Set<string>, source: string) {
  for (const char of source) {
    chars.add(char)
    const upper = char.toUpperCase()
    const lower = char.toLowerCase()
    if (upper.length === 1) chars.add(upper)
    if (lower.length === 1) chars.add(lower)
  }
}

function addText(chars: Set<string>, source: string) {
  for (const char of source) chars.add(char)
}

function textInTags(html: string, tags: string) {
  return Array.from(
    html.matchAll(
      new RegExp(
        `<(?:${tags})(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:${tags})>`,
        'gi',
      ),
    ),
    ([, text]) => text.replace(/<[^>]+>/g, ''),
  ).join('')
}

export function fontSubset(theme: Theme): AstroIntegration {
  const { faces } = theme.fonts.body
  const boldStems = faces
    .filter(({ weight }) => weight >= 600)
    .map(({ file }) => stem(file))
  const italicStems = faces
    .filter(({ style }) => style === 'italic')
    .map(({ file }) => stem(file))
  const prebuilt = theme.prebuilt.flatMap((directory) => [
    `${directory}/`,
    `${directory}${sep}`,
  ])

  return {
    name: 'font-subset',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const outputPath = fileURLToPath(dir)
        const bundledFonts = join(outputPath, '_astro')
        const chars = new Set<string>()
        const boldChars = new Set<string>()
        const italicChars = new Set<string>()

        await walk(outputPath, async (path) => {
          const file = relative(outputPath, path)
          if (prebuilt.some((prefix) => file.startsWith(prefix))) return
          if (path.endsWith('.html')) {
            const html = await readFile(path, 'utf8')
            if (html.includes(BUNDLE_REFERENCE)) {
              addWithCaseVariants(chars, decodeHTML(html))
              addText(boldChars, decodeHTML(textInTags(html, 'strong|b')))
              addText(italicChars, decodeHTML(textInTags(html, 'em|i')))
            }
            return
          }
          if (path.startsWith(bundledFonts) && /\.(css|js)$/.test(path)) {
            addWithCaseVariants(chars, await readFile(path, 'utf8'))
          }
        })

        const text = Array.from(chars).join('')
        let before = 0
        let after = 0
        let count = 0

        await walk(bundledFonts, async (path) => {
          if (!path.endsWith('.woff2')) return
          const original = await readFile(path)
          const fontStem = builtStem(path)
          const fontText = boldStems.includes(fontStem)
            ? Array.from(boldChars).join('')
            : italicStems.includes(fontStem)
              ? Array.from(italicChars).join('')
              : text
          const result = await subset(original, {
            text: fontText,
            flavor: 'woff2',
            ...(theme.fonts.stripHinting ? { 'no-hinting': true } : {}),
            'layout-features+': KEPT_LAYOUT_FEATURES,
          })
          if (result.length >= original.length) return
          await writeFile(path, result)
          before += original.length
          after += result.length
          count += 1
        })

        const saved = Math.round(((before - after) / before) * 100)
        logger.info(
          `Subset ${count} fonts to ${chars.size} glyphs: ${Math.round(before / 1024)}K to ${Math.round(after / 1024)}K (${saved}% smaller).`,
        )
      },
    },
  }
}
