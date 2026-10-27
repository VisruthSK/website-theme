import { dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COLOR_TOKENS, type Theme } from '../../config/theme'

type Color = Theme['colors'][keyof Theme['colors']]
type Face = { file: string; weight: number; style: string }

const FIXED_TOKENS = [
  ['tracking-tight', '0em'],
  ['focus-ring', '2px solid var(--ring)'],
  ['focus-ring-offset', '2px'],
  [
    'shadow-menu',
    'light-dark(0 4px 6px -1px oklch(0 0 0 / 0.1), 0 4px 6px -1px oklch(0 0 0 / 0.5))',
  ],
  [
    'shadow-popover',
    '0 10px 30px color-mix(in oklab, var(--foreground) 12%, transparent)',
  ],
  ['duration-fast', '200ms'],
]

const BUNDLED_MATH = {
  family: 'STIX Two Math',
  file: 'STIXTwoMath-Regular.woff2',
}

const FORMATS: Record<string, string> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
}

const FEATURE_FILES: Partial<Record<keyof Theme['features'], RegExp>> = {
  callouts: /[\\/]styles[\\/]callout\.css$/,
  math: /[\\/]styles[\\/]typography-math\.css$/,
  citations: /[\\/]components[\\/]Bibliography\.astro$/,
}

const stackEntry = (name: string) =>
  /^[a-z-]+$/i.test(name) ? name : `'${name}'`

export function themeStylesheet(theme: Theme, file: URL, root: URL) {
  const { palette, colors, fonts, features } = theme
  const resolve = (value: string) =>
    value in palette ? `var(--${value})` : value
  const color = (value: Color) =>
    typeof value === 'string'
      ? resolve(value)
      : `light-dark(${resolve(value.light)}, ${resolve(value.dark)})`
  const fontUrl = (name: string) => {
    const path = relative(
      dirname(fileURLToPath(file)),
      fileURLToPath(new URL(`${fonts.directory}/${name}`, root)),
    ).replaceAll('\\', '/')
    return path.startsWith('.') ? path : `./${path}`
  }
  const fontFace = (family: string, face: Face, src = fontUrl(face.file)) =>
    [
      '@font-face {',
      `  font-family: '${family}';`,
      `  font-style: ${face.style};`,
      `  font-weight: ${face.weight};`,
      '  font-display: block;',
      `  src: url('${src}') format('${FORMATS[face.file.split('.').pop() as string]}');`,
      '}',
    ].join('\n')
  const stack = (
    family: { family: string; fallback: string[] } | undefined,
    fallback: string[],
  ) =>
    [...(family ? [family.family, ...family.fallback] : fallback)]
      .map(stackEntry)
      .join(', ')

  const tokens = [
    'color-scheme: light dark;',
    ...Object.entries(palette).map(([name, value]) => `--${name}: ${value};`),
    ...COLOR_TOKENS.map((token) => `--${token}: ${color(colors[token])};`),
    ...FIXED_TOKENS.map(([name, value]) => `--${name}: ${value};`),
  ]
  const faces = [
    ...fonts.body.faces.map((face) => fontFace(fonts.body.family, face)),
    ...fonts.heading.faces.map((face) => fontFace(fonts.heading.family, face)),
    ...(features.dropCap && fonts.dropCap
      ? [fontFace(fonts.dropCap.family, fonts.dropCap)]
      : []),
    ...(fonts.mono?.faces.map((face) => fontFace(fonts.mono!.family, face)) ??
      []),
    ...(features.math
      ? [
          fonts.math
            ? fontFace(fonts.math.family, {
                file: fonts.math.file,
                weight: 400,
                style: 'normal',
              })
            : fontFace(
                BUNDLED_MATH.family,
                { file: BUNDLED_MATH.file, weight: 400, style: 'normal' },
                `@/assets/fonts/${BUNDLED_MATH.file}`,
              ),
        ]
      : []),
  ]
  const mathFamily = fonts.math?.family ?? BUNDLED_MATH.family
  const families = [
    `--font-sans: ${stack(fonts.heading, [])};`,
    `--font-serif: ${stack(fonts.body, [])};`,
    `--font-mono: ${stack(fonts.mono, ['ui-monospace', 'monospace'])};`,
    ...(features.math ? [`--font-math: ${stackEntry(mathFamily)}, math;`] : []),
  ]
  const block = (selector: string, lines: string[]) =>
    `${selector} {\n${lines.map((line) => `  ${line}`).join('\n')}\n}`

  return [
    block(':root', tokens),
    block('html', ['background-color: var(--background);']),
    ...faces,
    block(':root', families),
  ].join('\n\n')
}

function matchingBrace(code: string, open: number) {
  let depth = 0
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === '{') depth += 1
    else if (code[index] === '}' && --depth === 0) return index
  }
  throw new Error('Unbalanced @feature block')
}

function featureBlocks(code: string, features: Theme['features']) {
  let output = code
  for (
    let match = /@feature\s+([a-zA-Z]+)\s*\{/.exec(output);
    match;
    match = /@feature\s+([a-zA-Z]+)\s*\{/.exec(output)
  ) {
    const open = match.index + match[0].length - 1
    const close = matchingBrace(output, open)
    const name = match[1] as keyof Theme['features']
    if (!(name in features)) throw new Error(`Unknown feature ${name}`)
    const inner = features[name] ? output.slice(open + 1, close) : ''
    output = output.slice(0, match.index) + inner + output.slice(close + 1)
  }
  return output
}

export function themeCss(theme: Theme) {
  const prose: Record<string, string> = {
    'var(--prose-font-size)': theme.prose.fontSize,
    'var(--prose-line-height)': theme.prose.lineHeight,
    'var(--prose-indent)': theme.prose.indent,
    'var(--drop-cap-size)': theme.fonts.dropCap?.size ?? '0rem',
  }
  const blanked = Object.entries(FEATURE_FILES)
    .filter(([feature]) => !theme.features[feature as keyof Theme['features']])
    .map(([, pattern]) => pattern)
  return {
    name: 'theme-css',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const path = id.split('?')[0]
      if (!path.endsWith('.css') && !id.includes('type=style')) return
      if (blanked.some((pattern) => pattern.test(path))) return ''
      if (!code.includes('@feature') && !code.includes('var(--prose-')) return
      let output = featureBlocks(code, theme.features)
      for (const [token, value] of Object.entries(prose)) {
        output = output.replaceAll(token, value)
      }
      return output
    },
  }
}
