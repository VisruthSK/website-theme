import { SECTIONS, SITE, type SectionSlug } from "@/consts"
import { withBase } from "@/lib/base"
import { buildFeedItem } from "@/lib/content-render"
import {
  getAllPostsAndSubposts,
  getPostHref,
  type PostEntry,
} from "@/lib/data-utils"
import { resolveSiteUrl } from "@/lib/site-utils"
import rss, { type RSSFeedItem } from "@astrojs/rss"
import type { APIContext } from "astro"

type FeedEntry = { entry: PostEntry; href: string }

interface FeedOptions {
  title: string
  description: string
  entries: FeedEntry[]
}

export function respondWithFeed(
  context: APIContext,
  {
    title,
    description,
    items,
    trailingSlash,
  }: {
    title: string
    description: string
    items: RSSFeedItem[]
    trailingSlash?: boolean
  },
) {
  return rss({
    title,
    description,
    site: new URL(withBase("/"), resolveSiteUrl(context)).href,
    items: items.toSorted(
      (a, b) => (b.pubDate?.valueOf() ?? 0) - (a.pubDate?.valueOf() ?? 0),
    ),
    trailingSlash,
  })
}

export async function renderFeed(
  context: APIContext,
  { title, description, entries }: FeedOptions,
) {
  const baseUrl = resolveSiteUrl(context)
  const items = await Promise.all(
    entries.map(({ entry, href }) => buildFeedItem(entry, baseUrl, href)),
  )
  return respondWithFeed(context, { title, description, items })
}

export async function buildSectionFeed(context: APIContext, slug: SectionSlug) {
  try {
    const section = SECTIONS[slug]
    const posts = await getAllPostsAndSubposts(section.collection)
    return renderFeed(context, {
      title: `${SITE.title} - ${section.label}`,
      description: `${section.label} from ${SITE.author}`,
      entries: posts
        .filter((post) => post.data.rss !== false)
        .map((entry) => ({ entry, href: getPostHref(entry) })),
    })
  } catch (error) {
    console.error(`Error generating RSS feed for ${slug}:`, error)
    return new Response("Error generating RSS feed", { status: 500 })
  }
}
