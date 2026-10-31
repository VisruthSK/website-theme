import type { AstroIntegration } from 'astro'
import { mkdir, writeFile } from 'node:fs/promises'
import type { Theme } from '../../config/theme'
import { codeAssets } from '../lib/markdown/code'
import { themeStylesheet } from './theme-css'

export function generatedAssets(theme: Theme): AstroIntegration {
  return {
    name: 'generated-assets',
    hooks: {
      'astro:config:setup': async ({ config }) => {
        const { baseStyles, themeStyles, jsModules } = await codeAssets
        const directory = new URL('generated/', config.srcDir)
        const stylesheet = new URL('theme.css', directory)
        await mkdir(directory, { recursive: true })
        await writeFile(
          new URL('code.css', directory),
          baseStyles + themeStyles,
        )
        await writeFile(new URL('code.js', directory), jsModules.join('\n'))
        await writeFile(
          stylesheet,
          themeStylesheet(theme, stylesheet, config.root),
        )
      },
    },
  }
}
