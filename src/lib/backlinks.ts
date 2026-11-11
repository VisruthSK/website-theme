import { SECTIONS, SECTION_SLUGS } from "@/consts"
import { linkedPaths, normalize } from "./backlink-paths"
import { renderEntryContent } from "@/lib/content-render"
import {
  getAllPostsAndSubposts,
  getPostHref,
  type PostEntry,
} from "@/lib/data-utils"
import { siteBase } from "@/lib/site-utils"

export async function buildBacklinks(site: string) {
  const posts = (
    await Promise.all(
      SECTION_SLUGS.map((slug) =>
        getAllPostsAndSubposts(SECTIONS[slug].collection),
      ),
    )
  ).flat()
  const origin = new URL(site).origin
  const baseUrl = siteBase()
  const targets = new Map(
    posts.map((post) => [normalize(getPostHref(post)), post]),
  )
  const htmls = await Promise.all(
    posts.map((post) => renderEntryContent(post, baseUrl)),
  )
  const backlinks = new Map<string, PostEntry[]>()
  for (const [index, post] of posts.entries()) {
    const href = getPostHref(post)
    for (const path of linkedPaths(htmls[index], href, origin)) {
      if (path === normalize(href) || !targets.has(path)) continue
      const incoming = backlinks.get(path) ?? []
      incoming.push(post)
      backlinks.set(path, incoming)
    }
  }
  return (post: PostEntry) => backlinks.get(normalize(getPostHref(post))) ?? []
}
