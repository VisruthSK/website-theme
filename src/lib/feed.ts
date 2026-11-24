import { SECTIONS, SECTION_SLUGS, SITE, type SectionSlug } from "@/consts"
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

export async function collectFeedEntries(): Promise<FeedEntry[]> {
  const collected = await Promise.all(
    SECTION_SLUGS.map(async (slug) => {
      const posts = await getAllPostsAndSubposts(SECTIONS[slug].collection)
      return posts
        .filter((post) => post.data?.rss !== false)
        .map((entry) => ({ entry, href: getPostHref(entry) }))
    }),
  )
  return collected.flat()
}

export async function renderJsonFeed(
  context: APIContext,
  { title, description, entries }: FeedOptions,
) {
  const baseUrl = resolveSiteUrl(context)
  const items = await Promise.all(
    entries.map(({ entry, href }) => buildFeedItem(entry, baseUrl, href)),
  )
  const site = new URL(withBase("/"), resolveSiteUrl(context)).href
  return new Response(
    JSON.stringify({
      version: "https://jsonfeed.org/version/1.1",
      title,
      description,
      home_page_url: site,
      feed_url: new URL(withBase("/feed.json"), resolveSiteUrl(context)).href,
      language: SITE.locale,
      authors: [{ name: SITE.author }],
      items: items
        .toSorted(
          (a, b) => (b.pubDate?.valueOf() ?? 0) - (a.pubDate?.valueOf() ?? 0),
        )
        .map(({ title, link, content, description, pubDate, categories }) => ({
          id: link,
          url: link,
          title,
          content_html: content,
          summary: description,
          date_published: pubDate?.toISOString(),
          tags: categories,
        })),
    }),
    {
      headers: {
        "Content-Type": "application/feed+json",
      },
    },
  )
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
