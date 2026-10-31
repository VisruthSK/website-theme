import { linkedPaths, normalize } from './backlink-paths'
import { SECTIONS, SECTION_SLUGS } from '@/consts'
import { renderEntryContent } from '@/lib/content-render'
import {
  getAllPostsAndSubposts,
  getPostHref,
  type PostEntry,
} from '@/lib/data-utils'

export async function buildBacklinks(site: string) {
  const posts = (
    await Promise.all(
      SECTION_SLUGS.map((slug) =>
        getAllPostsAndSubposts(SECTIONS[slug].collection),
      ),
    )
  ).flat()
  const origin = new URL(site).origin
  const targets = new Map(
    posts.map((post) => [normalize(getPostHref(post)), post]),
  )
  const backlinks = new Map<string, PostEntry[]>()
  for (const post of posts) {
    const href = getPostHref(post)
    const html = await renderEntryContent(post, new URL(href, origin).href)
    for (const path of linkedPaths(html, href, origin)) {
      if (path === normalize(href) || !targets.has(path)) continue
      const incoming = backlinks.get(path) ?? []
      incoming.push(post)
      backlinks.set(path, incoming)
    }
  }
  return (post: PostEntry) => backlinks.get(normalize(getPostHref(post))) ?? []
}
