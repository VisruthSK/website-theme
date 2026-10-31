import { getCollection, type CollectionEntry } from 'astro:content'

import { COLLECTION_TO_SECTION, SECTIONS } from '@/consts'
import { calculateWordCountFromHtml, readingTime } from '@/lib/site-utils'
import { formatCount } from '@/lib/text'
import type { ContentCollection } from '@/types'

type EntryFor<C extends ContentCollection> = CollectionEntry<C>
export type PostEntry = CollectionEntry<ContentCollection>

const INCLUDE_DRAFTS = import.meta.env.DEV
const INCLUDE_FUTURE_POSTS = import.meta.env.DEV && !import.meta.env.SITE_NOW
const BUILD_NOW = new Date(import.meta.env.SITE_NOW ?? Date.now())

if (Number.isNaN(BUILD_NOW.valueOf())) {
  throw new Error(`Invalid SITE_NOW value "${import.meta.env.SITE_NOW}"`)
}

const newestFirst = (a: PostEntry, b: PostEntry) =>
  b.data.date.valueOf() - a.data.date.valueOf()

const slugOf = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')

export const isSubpost = (postId: string) => postId.includes('/')

export const getParentId = (subpostId: string) => subpostId.split('/')[0]

export function getPostHref(entry: PostEntry): string {
  const section = SECTIONS[COLLECTION_TO_SECTION[entry.collection]]
  return `${section.href}/${entry.id}/`
}

function isVisible(post: PostEntry): boolean {
  const published =
    INCLUDE_FUTURE_POSTS || post.data.date.valueOf() <= BUILD_NOW.valueOf()
  return published && (INCLUDE_DRAFTS || !post.data.draft)
}

async function entriesOf<C extends ContentCollection>(
  collection: C,
): Promise<EntryFor<C>[]> {
  return (await getCollection(collection)) as EntryFor<C>[]
}

async function getAllPosts<C extends ContentCollection>(collection: C) {
  const posts = await entriesOf(collection)
  return posts
    .filter((post) => isVisible(post) && !isSubpost(post.id))
    .sort(newestFirst)
}

function inListedOrder<T extends PostEntry>(
  subposts: T[],
  order: string[],
  parent: string,
): T[] {
  const bySlug = new Map(
    subposts.map((post) => [slugOf(post.id.split('/')[1]), post]),
  )
  const names = order
    .map((entry) =>
      entry
        .trim()
        .replace(/\\/g, '/')
        .split('/')
        .pop()!
        .replace(/\.md$/i, '')
        .trim(),
    )
    .filter(Boolean)
  const missing = names.filter((name) => !bySlug.has(slugOf(name)))
  if (missing.length > 0) {
    throw new Error(
      `Subpost ordering error for parent "${parent}": entries not found: [${missing.join(', ')}]. Existing subposts: [${[...bySlug.keys()].join(', ') || '(none)'}]`,
    )
  }
  return names.map((name) => bySlug.get(slugOf(name))!)
}

export async function getSubpostsForParent<C extends ContentCollection>(
  parentId: string,
  collection: C,
): Promise<EntryFor<C>[]> {
  const entries = await entriesOf(collection)
  const subposts = entries.filter(
    (post) => isSubpost(post.id) && getParentId(post.id) === parentId,
  )
  const order = entries.find((post) => post.id === parentId)?.data.order
  const ordered = order?.length
    ? inListedOrder(subposts, order, `${collection}/${parentId}`)
    : subposts.sort((a, b) => a.id.localeCompare(b.id))
  return ordered.filter(isVisible)
}

export async function getAllPostsAndSubposts<C extends ContentCollection>(
  collection: C,
): Promise<EntryFor<C>[]> {
  const parents = await getAllPosts(collection)
  const chapters = await Promise.all(
    parents.map((parent) => getSubpostsForParent(parent.id, collection)),
  )
  return parents.flatMap((parent, index) => [parent, ...chapters[index]])
}

export async function getAllPostsAndSubpostsChrono<C extends ContentCollection>(
  collection: C,
): Promise<EntryFor<C>[]> {
  const posts = await entriesOf(collection)
  return posts.filter(isVisible).sort(newestFirst)
}

export async function getParentPost<C extends ContentCollection>(
  subpostId: string,
  collection: C,
): Promise<EntryFor<C> | null> {
  if (!isSubpost(subpostId)) return null
  const parentId = getParentId(subpostId)
  const posts = await getAllPosts(collection)
  return posts.find((post) => post.id === parentId) ?? null
}

export async function getAllTags(
  collections: ContentCollection | ContentCollection[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const collection of [collections].flat()) {
    for (const post of await getAllPosts(collection)) {
      const drafted = INCLUDE_DRAFTS && post.data.draft ? ['draft'] : []
      for (const tag of [...(post.data.tags ?? []), ...drafted]) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
  }
  return counts
}

export async function getSortedTags(
  collections: ContentCollection | ContentCollection[],
): Promise<{ tag: string; count: number }[]> {
  const counts = await getAllTags(collections)
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export async function getPostsByTag<C extends ContentCollection>(
  tag: string,
  collection: C,
): Promise<EntryFor<C>[]> {
  const posts = await getAllPosts(collection)
  return posts.filter((post) =>
    tag === 'draft' ? post.data.draft : post.data.tags?.includes(tag),
  )
}

export function groupPostsByYear<C extends ContentCollection>(
  posts: EntryFor<C>[],
): Record<string, EntryFor<C>[]> {
  return posts.reduce(
    (groups, post) => {
      const year = post.data.date.getFullYear().toString()
      ;(groups[year] ??= []).push(post)
      return groups
    },
    {} as Record<string, EntryFor<C>[]>,
  )
}

export async function getPostStats(post: PostEntry) {
  const wordCount = calculateWordCountFromHtml(post.body)
  const chapters = isSubpost(post.id)
    ? []
    : await getSubpostsForParent(post.id, post.collection)
  const combinedWordCount = chapters.length
    ? chapters.reduce(
        (total, chapter) => total + calculateWordCountFromHtml(chapter.body),
        wordCount,
      )
    : null

  return {
    wordCount,
    readingTime: readingTime(wordCount),
    subpostCount: chapters.length ? chapters.length + 1 : 0,
    combinedWordCount,
    combinedReadingTime:
      combinedWordCount === null ? null : readingTime(combinedWordCount),
  }
}

export function postStatItems(stats: Awaited<ReturnType<typeof getPostStats>>) {
  const combined =
    stats.combinedWordCount !== null &&
    stats.combinedWordCount !== stats.wordCount
  return [
    `${formatCount(stats.wordCount)} words${combined ? ` (${formatCount(stats.combinedWordCount!)} total)` : ''}`,
    `${stats.readingTime}${combined ? ` (${stats.combinedReadingTime} total)` : ''}`,
    stats.subpostCount > 0 &&
      `${stats.subpostCount} chapter${stats.subpostCount === 1 ? '' : 's'}`,
  ]
}

type RenderedHeading = {
  slug: string
  text: string
  depth: number
}

export function withReferencesHeading(
  headings: RenderedHeading[],
  hasBibliography: boolean,
): RenderedHeading[] {
  const hadReferences = headings.some(({ slug }) => slug === 'references')
  const next = headings.filter(
    ({ slug }) => slug !== 'references' && slug !== 'footnotes',
  )
  if (hasBibliography || hadReferences) {
    next.push({ slug: 'references', text: 'References', depth: 2 })
  }
  return next
}
