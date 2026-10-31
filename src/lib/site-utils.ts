import { SITE } from '@/consts'

export function calculateWordCountFromHtml(
  html: string | null | undefined,
): number {
  if (!html) return 0
  const textOnly = html.replace(/<[^>]+>/g, '')
  return textOnly.split(/\s+/).filter(Boolean).length
}

export const siteOrigin = ({ site, url }: { site?: URL; url: URL }) =>
  site ?? new URL(url.origin)

export function readingTime(wordCount: number): string {
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200))
  return `${readingTimeMinutes} min read`
}

const CANONICAL_BASE_URL = 'https://canonical.local'

function hasFileExtension(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  const lastSegment = parts[parts.length - 1] || ''
  return lastSegment.includes('.')
}

function canonicalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (trimmed === '/' || !trimmed.startsWith('/')) return trimmed

  const url = new URL(trimmed, CANONICAL_BASE_URL)
  let pathname = url.pathname.replace(/\/{2,}/g, '/')

  if (
    pathname !== '/' &&
    !pathname.endsWith('/') &&
    !hasFileExtension(pathname)
  ) {
    pathname = `${pathname}/`
  }

  url.pathname = pathname
  return `${url.pathname}${url.search}${url.hash}`
}

export function canonicalizePathSegments(
  ...segments: Array<string | undefined | null>
): string {
  const normalized = segments
    .filter((segment): segment is string => typeof segment === 'string')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (normalized.length === 0) return '/'

  const joined = normalized
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')

  if (!joined) return '/'
  return canonicalizePath(`/${joined}`)
}

export const plainTitle = (title: string) => title.replaceAll('`', '')

export const pageTitle = (title: string) => `${title} | ${SITE.title}`
