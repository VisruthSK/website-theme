import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseTheme } from '../../config/theme.ts'
import { themeCss, themeStylesheet } from '../../src/integrations/theme-css.ts'
import { SITES } from '../sites.ts'

const example = JSON.parse(readFileSync('examples/full/theme.json', 'utf8'))
const minimal = JSON.parse(readFileSync('examples/minimal/theme.json', 'utf8'))

const failure = (input: unknown) => {
  try {
    parseTheme(input)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('expected the theme to be rejected')
}

test.describe('schema', () => {
  test('both example configurations are valid and filled with defaults', () => {
    const theme = parseTheme(minimal)
    expect(theme.site.featured).toEqual([])
    expect(theme.colors['ink-muted']).toEqual({
      light: 'color-mix(in oklab, var(--foreground) 65%, transparent)',
      dark: 'color-mix(in oklab, var(--foreground) 75%, transparent)',
    })
    expect(theme.fonts.directory).toBe('src/assets/fonts')
    expect(parseTheme(example).features.typeset).toBe(true)
  })

  test('unknown keys are rejected with their path', () => {
    expect(failure({ ...example, extra: 1 })).toContain('(root)')
    expect(
      failure({ ...example, site: { ...example.site, colour: 'red' } }),
    ).toMatch(/site: Unrecognized key/)
  })

  test('missing values name the key', () => {
    const { title: _, ...site } = example.site
    expect(failure({ ...example, site })).toContain('site.title')
  })

  test('colours default to the astro-erudite palette', () => {
    const { palette: _, colors: __, ...bare } = example
    const theme = parseTheme(bare)
    expect(theme.colors.background).toEqual({
      light: '#fcfcfc',
      dark: '#111111',
    })
    expect(theme.colors.foreground).toEqual({
      light: '#202020',
      dark: '#eeeeee',
    })
  })

  test('navigation must name a configured section', () => {
    expect(
      failure({ ...example, navigation: [{ section: 'missing' }] }),
    ).toContain('navigation.0.section: unknown section missing')
  })

  test('a drop cap needs a face and sections must be distinct', () => {
    const { dropCap: _, ...fonts } = example.fonts
    expect(failure({ ...example, fonts })).toContain('fonts.dropCap')
    expect(
      failure({
        ...example,
        sections: [example.sections[0], example.sections[0]],
      }),
    ).toContain('duplicate section essays')
  })
})

test.describe('generated stylesheet', () => {
  const root = new URL('../../examples/full/', import.meta.url)
  const file = new URL('src/generated/theme.css', root)
  const css = themeStylesheet(SITES.example.theme, file, root)

  test('palette names become custom properties and references', () => {
    const named = themeStylesheet(
      parseTheme({
        ...example,
        palette: {
          paper: 'oklch(0.985 0.004 250)',
          'paper-dark': 'oklch(0.17 0.015 255)',
        },
        colors: { background: { light: 'paper', dark: 'paper-dark' } },
      }),
      file,
      root,
    )
    expect(named).toContain('--paper: oklch(0.985 0.004 250);')
    expect(named).toContain(
      '--background: light-dark(var(--paper), var(--paper-dark));',
    )
    expect(named).toContain('--focus-ring: 2px solid var(--ring);')
  })

  test('font faces point at the configured files', () => {
    expect(css).toContain("font-family: 'IBM Plex Sans';")
    expect(css).toContain(
      "src: url('../assets/fonts/plex-sans-400-italic.woff2') format('woff2');",
    )
    expect(css).toContain("--font-serif: 'IBM Plex Sans', ui-serif,")
    expect(css).toContain("--font-mono: 'IBM Plex Mono', ui-monospace,")
    expect(css).toContain('STIXTwoMath-Regular.woff2')
    expect(css).toContain("--font-math: 'STIX Two Math', math;")
  })

  test('small capitals follow the body font setting', () => {
    expect(css).toContain('--opening-caps: normal;')
    const capable = parseTheme({
      ...example,
      fonts: {
        ...example.fonts,
        body: { ...example.fonts.body, smallCaps: true },
      },
    })
    expect(themeStylesheet(capable, file, root)).toContain(
      '--opening-caps: small-caps;',
    )
  })

  test('the math font can be swapped', () => {
    const swapped = parseTheme({
      ...example,
      fonts: {
        ...example.fonts,
        math: { family: 'Latin Modern Math', file: 'latinmodern-math.woff2' },
      },
    })
    const output = themeStylesheet(swapped, file, root)
    expect(output).toContain("font-family: 'Latin Modern Math';")
    expect(output).toContain('latinmodern-math.woff2')
    expect(output).toContain("--font-math: 'Latin Modern Math', math;")
    expect(output).not.toContain('STIXTwoMath')
  })

  test('disabled features and missing faces leave no rules behind', () => {
    const minimalCss = themeStylesheet(SITES.minimal.theme, file, root)
    expect(minimalCss).not.toContain('STIX')
    expect(minimalCss).not.toContain('--font-math')
    expect(minimalCss).toContain('--font-mono: ui-monospace, monospace;')
    expect(minimalCss).toContain(
      "--font-serif: 'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif;",
    )
  })
})

test.describe('stylesheet transform', () => {
  const css = `p { font-size: var(--prose-font-size); text-indent: var(--prose-indent); @feature dropCap { .drop-cap { float: left; } } } @feature search { .hit { color: red; } }`

  test('prose settings and enabled features are substituted in place', () => {
    const { transform } = themeCss(SITES.example.theme)
    const output = transform(css, '/x/styles/prose.css') as string
    expect(output).toContain('font-size: 1.125rem')
    expect(output).toContain('text-indent: 1.35em')
    expect(output).toContain('.drop-cap { float: left; }')
    expect(output).not.toContain('@feature')
  })

  test('disabled features and their stylesheets are removed', () => {
    const { transform } = themeCss(SITES.minimal.theme)
    const output = transform(css, '/x/styles/prose.css') as string
    expect(output).toContain('font-size: 1.0625rem')
    expect(output).not.toContain('drop-cap')
    expect(output).not.toContain('.hit')
    expect(transform('.c { color: red }', '/u/styles/callout.css')).toBe('')
    expect(
      transform(
        '.b { color: red }',
        '/t/components/Bibliography.astro?astro&type=style&index=0&lang.css',
      ),
    ).toBe('')
    expect(transform('.c { color: red }', '/u/styles/layout.css')).toBe(
      undefined,
    )
  })
})
