import { SECTIONS, SECTION_SLUGS, SITE } from "@/consts"
import { getAllPostsAndSubposts, getPostHref } from "@/lib/data-utils"
import { renderFeed } from "@/lib/feed"
import type { APIContext } from "astro"

export async function GET(context: APIContext) {
  try {
    const entries = (
      await Promise.all(
        SECTION_SLUGS.map(async (slug) => {
          const posts = await getAllPostsAndSubposts(SECTIONS[slug].collection)
          return posts
            .filter((post) => post.data?.rss !== false)
            .map((entry) => ({ entry, href: getPostHref(entry) }))
        }),
      )
    ).flat()

    return renderFeed(context, {
      title: SITE.title,
      description: SITE.description,
      entries,
    })
  } catch (error) {
    console.error("Error generating RSS feed:", error)
    return new Response("Error generating RSS feed", { status: 500 })
  }
}
