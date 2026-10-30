import type { AstroIntegration } from 'astro'
import { build } from 'esbuild'
import type { Element, Root } from 'hast'
import { fromHtml } from 'hast-util-from-html'
import { glob, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Theme } from '../../config/theme.ts'
import { buildCache, digest } from '../lib/build-cache.ts'
import { typesetConstants } from '../lib/typeset/constants.ts'
import { encodePlan } from '../lib/typeset/encode.ts'
import { loadFaces, typefaceFiles } from '../lib/typeset/fonts.ts'
import {
  Unsupported,
  classes,
  readParagraph,
} from '../lib/typeset/paragraph.ts'
import { capWidth, planParagraph, prepareSource } from '../lib/typeset/plan.ts'
import { edgeTables } from '../lib/typeset/optical.ts'
import { TYPESET_SCRIPT } from './early-hints.ts'

interface Found {
  paragraph: Element
  previous: Element | undefined
}

function proseParagraphs(tree: Root): Found[] {
  const found: Found[] = []
  const visit = (parent: Root | Element, inside: boolean) => {
    let previous: Element | undefined
    for (const child of parent.children) {
      if (child.type !== 'element') continue
      const entering = child.tagName === 'prose-content'
      if (entering && 'dataCompact' in child.properties) {
        previous = child
        continue
      }
      const skipped =
        child.tagName === 'side-note' ||
        (child.tagName === 'section' && 'dataFootnotes' in child.properties)
      if (!skipped) {
        if (inside && child.tagName === 'p')
          found.push({ paragraph: child, previous })
        visit(child, inside || entering)
      }
      previous = child
    }
  }
  visit(tree, false)
  return found
}

const TYPESET_LIBRARY = new URL('../lib/typeset/', import.meta.url)

async function typesetSources() {
  const names = (await readdir(TYPESET_LIBRARY)).sort()
  return Promise.all(
    names.map((name) => readFile(new URL(name, TYPESET_LIBRARY))),
  )
}

async function fontBytes(theme: Theme, root: URL) {
  const directory = new URL(`${theme.fonts.directory}/`, root)
  const files = Object.values(typefaceFiles(theme.fonts))
    .filter((name): name is string => name !== undefined)
    .sort()
  return Promise.all(files.map((name) => readFile(new URL(name, directory))))
}

async function load(theme: Theme, root: URL) {
  const { constants, source } = typesetConstants(
    theme.prose,
    theme.fonts.dropCap?.tolerance ?? 0.35,
  )
  const faces = await loadFaces(
    fileURLToPath(new URL(`${theme.fonts.directory}/`, root)),
    typefaceFiles(theme.fonts),
  )
  const roman = faces('roman', [])
  const key = digest(
    source,
    ...(await typesetSources()),
    ...(await fontBytes(theme, root)),
  )
  if (
    theme.features.dropCap &&
    theme.fonts.body.smallCaps &&
    roman.advance('aeo') === faces('roman', ['smcp']).advance('aeo')
  ) {
    throw new Error(
      'fonts.body.smallCaps is true but the body font has no small capitals; set it to false.',
    )
  }
  const cache = buildCache(root, 'edges')
  const stored = await cache.read(key)
  const edges: ReturnType<typeof edgeTables> = stored
    ? JSON.parse(stored.toString())
    : edgeTables(faces)
  if (!stored) await cache.write(key, JSON.stringify(edges))
  return { faces, edges, constants, source, key }
}

type Assets = Awaited<ReturnType<typeof load>>

const rounded = (_: string, value: unknown) =>
  typeof value === 'number' ? Math.round(value * 1000) / 1000 : value

async function writeRenderer({ faces, edges, source }: Assets, directory: URL) {
  const constants = new URL('typeset-constants.js', directory)
  await mkdir(directory, { recursive: true })
  await writeFile(
    constants,
    `${source}
export const SPACE = ${faces('roman', ['pnum']).advance(' ')}
export const EDGES = ${JSON.stringify(edges, rounded)}
`,
  )
  const { outputFiles } = await build({
    entryPoints: [
      fileURLToPath(new URL('../scripts/typeset.js', import.meta.url)),
    ],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    write: false,
    plugins: [
      {
        name: 'generated',
        setup(build) {
          build.onResolve({ filter: /^@\/generated\// }, ({ path }) => ({
            path: fileURLToPath(new URL(path.slice(12), directory)),
          }))
        },
      },
    ],
  })
  await writeFile(new URL('typeset.js', directory), outputFiles[0].text)
}

async function planner(
  { faces, edges, constants, key: sourcesKey }: Assets,
  capSize: number,
  root: URL,
) {
  const store = buildCache(root, 'plans')
  const storeKey = digest(sourcesKey, String(capSize))
  const stored = await store.read(storeKey)
  const cache = new Map<string, string | null>(
    stored ? JSON.parse(stored.toString()) : [],
  )
  const known = cache.size
  const planFor = ({ paragraph, previous }: Found): string | null => {
    const source = readParagraph(paragraph)
    const cap = source.cap ? capWidth(source.cap, faces, constants, capSize) : 0
    const indented =
      !cap &&
      previous?.tagName === 'p' &&
      !(
        classes(previous).includes('preamble') &&
        classes(paragraph).includes('preamble')
      )
    const indent = indented ? constants.INDENT : 0

    const key = digest(JSON.stringify([source, indent, cap]))
    if (!cache.has(key)) {
      const prepared = prepareSource(source, faces, edges)
      const bands = planParagraph(prepared, { indent, cap }, constants)
      const multiline = bands.some((band) => band.breaks?.length)
      cache.set(
        key,
        multiline
          ? encodePlan(
              { words: prepared.words.length, indent, cap },
              bands,
              constants,
            )
          : null,
      )
    }
    return cache.get(key) ?? null
  }
  const save = () =>
    cache.size > known
      ? store.write(storeKey, JSON.stringify([...cache]))
      : undefined
  return { planFor, save }
}

export function typeset(theme: Theme, root: URL): AstroIntegration {
  let shared: ReturnType<typeof load> | undefined
  const assets = () => (shared ??= load(theme, root))
  return {
    name: 'typeset',
    hooks: {
      'astro:config:setup': async ({ config }) =>
        writeRenderer(await assets(), new URL('generated/', config.srcDir)),
      'astro:build:done': async ({ dir, logger }) => {
        const outputPath = fileURLToPath(dir)
        const { planFor, save } = await planner(
          await assets(),
          parseFloat(theme.fonts.dropCap?.size ?? '0rem'),
          root,
        )
        const skipped = new Map<string, number>()
        let planned = 0
        let pages = 0
        let bytes = 0

        for await (const file of glob('**/*.html', { cwd: outputPath })) {
          const path = join(outputPath, file)
          const html = await readFile(path, 'utf8')
          if (!TYPESET_SCRIPT.test(html)) continue
          pages += 1

          const insertions: { at: number; text: string }[] = []
          for (const found of proseParagraphs(fromHtml(html))) {
            const at = found.paragraph.position?.start.offset
            if (at === undefined) continue
            try {
              const data = planFor(found)
              if (!data) continue
              planned += 1
              bytes += data.length
              insertions.push({ at: at + '<p'.length, text: ` data-j=${data}` })
            } catch (error) {
              if (!(error instanceof Unsupported)) throw error
              skipped.set(error.message, (skipped.get(error.message) ?? 0) + 1)
            }
          }

          if (!insertions.length) continue
          let output = html
          for (const { at, text } of insertions.sort((a, b) => b.at - a.at)) {
            output = output.slice(0, at) + text + output.slice(at)
          }
          await writeFile(path, output)
        }

        await save()
        const reasons = [...skipped].map(
          ([reason, count]) => `${count} ${reason}`,
        )
        if (pages && !planned) {
          throw new Error(
            `No paragraph on any page received a typeset plan: ${reasons.join(', ')}`,
          )
        }
        logger.info(
          `Typeset ${planned} paragraphs (${(bytes / 1024).toFixed(1)} KB of plans)` +
            (reasons.length ? `; left native: ${reasons.join(', ')}` : ''),
        )
      },
    },
  }
}
