import { SECTIONS, SECTION_SLUGS, SITE } from "@/consts"
import { getAllTags, getPostHref, getPostsByTag } from "@/lib/data-utils"
import { renderFeed } from "@/lib/feed"
import type { APIContext, GetStaticPaths } from "astro"

const collections = SECTION_SLUGS.map((slug) => SECTIONS[slug].collection)

export const getStaticPaths: GetStaticPaths = async () => {
  const tagsMap = await getAllTags(collections)
  return Array.from(tagsMap.keys()).map((tag) => ({
    params: { tag },
    props: { tag },
  }))
}

export async function GET(context: APIContext) {
  const raw = context.params?.tag
  if (!raw) {
    return new Response("Tag not specified", { status: 400 })
  }

  const tag = decodeURIComponent(raw)
  const postsByCollection = await Promise.all(
    collections.map((collection) => getPostsByTag(tag, collection)),
  )

  const posts = postsByCollection
    .flat()
    .filter((post) => post.data.rss !== false)

  return renderFeed(context, {
    title: `${SITE.title} — #${tag}`,
    description: `Posts tagged with "${tag}" from ${SITE.title}`,
    entries: posts.map((entry) => ({ entry, href: getPostHref(entry) })),
  })
}
