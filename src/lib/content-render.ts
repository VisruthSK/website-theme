import Bibliography from '@/components/Bibliography.astro'
import { FEATURES } from '@/consts'
import type { PostEntry } from '@/lib/data-utils'
import { extractCitedKeys } from '@/lib/markdown/cite'
import type { RSSFeedItem } from '@astrojs/rss'
import type { APIContext } from 'astro'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { loadRenderers } from 'astro:container'
import { render, type CollectionEntry } from 'astro:content'

type RenderableEntry = PostEntry | CollectionEntry<'pages'>
type Replacement = [RegExp, string | ((...match: string[]) => string)]

const HIDDEN_WARNING = '`markdown.gfm` and `markdown.smartypants`'

async function createContainer() {
  const renderers = await loadRenderers([])
  const warn = console.warn
  console.warn = (...args) => {
    const message = String(args[0] ?? '')
    if (!(message.includes(HIDDEN_WARNING) && message.includes('deprecated'))) {
      warn(...args)
    }
  }
  try {
    return await AstroContainer.create({ renderers })
  } finally {
    console.warn = warn
  }
}

let container: ReturnType<typeof createContainer> | undefined
const renderedContent = new Map<string, Promise<string>>()

const BODY = /<body[^>]*>([\s\S]*?)<\/body>/i
const URL_ATTRIBUTE = /(href|src)=(["'])([^"']*)\2/gi
const SRCSET_ATTRIBUTE = /(srcset)=(["'])([^"']*)\2/gi
const ABSOLUTE_URL = /^(#|\/\/|[a-z][a-z0-9+\-.]*:)/i

const CLEANUPS: Replacement[] = [
  [/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''],
  [/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''],
  [/<side-note\b[^>]*>[\s\S]*?<\/side-note>/gi, ''],
  [/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ''],
  [/<hr\b[^>]*>/gi, '<hr />'],
  [/<!--[\s\S]*?-->/g, ''],
  [/<span>\s*<\/span>/gi, ''],
  [/\sdata-astro-[\w-]+(?:="[^"]*")?/gi, ''],
  [
    /\b(id=|href=)(["'])(#?)user-content-fn(ref)?-([^"']+)\2/g,
    (_, attribute, quote, hash, ref = '', name) =>
      `${attribute}${quote}${hash}fn${ref}:${name}${quote}`,
  ],
  [
    /(<a\b[^>]*data-footnote-backref[^>]*>)<span class="sr-only">[^<]*<\/span>(<\/a>)/g,
    '$1↩︎$2',
  ],
  [
    /<a\b(?=[^>]*\bdata-footnote-ref\b)/g,
    '<a rel="footnote" role="doc-noteref"',
  ],
  [/<a\b(?=[^>]*\bdata-footnote-backref\b)/g, '<a role="doc-backlink"'],
  [/<section\b(?=[^>]*\bdata-footnotes\b)/g, '<section role="doc-endnotes"'],
  [/<li id="(fn:[^"]+)"/g, '<li id="$1" role="doc-endnote"'],
]

const withTrailingSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`)

function absolutizeUrl(value: string, baseUrl: string): string {
  if (!value || ABSOLUTE_URL.test(value)) return value
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return value
  }
}

function absolutizeSrcset(value: string, baseUrl: string): string {
  return value
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => {
      const [url, ...descriptor] = candidate.split(/\s+/)
      return [absolutizeUrl(url, baseUrl), ...descriptor].join(' ')
    })
    .join(', ')
}

function sanitizeHtml(html: string, baseUrl: string): string {
  const page = html.replace(/^<!DOCTYPE html>/i, '')
  const body = page.match(BODY)?.[1] ?? page
  return CLEANUPS.reduce(
    (result, [pattern, replacement]) =>
      result.replace(pattern, replacement as string),
    body,
  )
    .replace(
      URL_ATTRIBUTE,
      (_, name, quote, url) =>
        `${name}=${quote}${absolutizeUrl(url, baseUrl)}${quote}`,
    )
    .replace(
      SRCSET_ATTRIBUTE,
      (_, name, quote, srcset) =>
        `${name}=${quote}${absolutizeSrcset(srcset, baseUrl)}${quote}`,
    )
    .trim()
}

async function renderUncached(entry: RenderableEntry, baseUrl: string) {
  const rendering = await (container ??= createContainer())
  const { Content } = await render(entry)
  const bib =
    FEATURES.citations && 'bib' in entry.data ? entry.data.bib : undefined
  const citedKeys = bib ? extractCitedKeys(entry.body) : []
  const pages = [await rendering.renderToString(Content, { params: {} })]
  if (bib && citedKeys.length > 0) {
    pages.push(
      await rendering.renderToString(Bibliography, {
        props: { bib, citedKeys },
      }),
    )
  }
  return pages
    .filter(Boolean)
    .map((html) => sanitizeHtml(html, baseUrl))
    .join('\n')
}

export function renderEntryContent(entry: RenderableEntry, baseUrl: string) {
  const key = `${entry.collection}:${entry.id}:${baseUrl}`
  let content = renderedContent.get(key)
  if (!content) {
    content = renderUncached(entry, baseUrl)
    renderedContent.set(key, content)
  }
  return content
}

export function resolveSiteUrl(context: APIContext, fallback: string): string {
  return (context.site?.toString() ?? fallback).replace(/\/$/, '')
}

export async function buildFeedItem(
  entry: PostEntry,
  baseUrl: string,
  relativeLink: string,
): Promise<RSSFeedItem> {
  const base = withTrailingSlash(baseUrl)
  return {
    title: entry.data.title,
    description: entry.data.description,
    pubDate: entry.data.date,
    link: absolutizeUrl(relativeLink, base),
    content: await renderEntryContent(entry, base),
    categories: entry.data.tags ?? undefined,
  }
}
