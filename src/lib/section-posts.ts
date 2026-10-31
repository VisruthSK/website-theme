import { SECTIONS, SECTION_SLUGS } from "@/consts"
import {
  getAllPostsAndSubposts,
  getAllPostsAndSubpostsChrono,
  newestFirst,
  type PostEntry,
} from "@/lib/data-utils"

async function collect(
  load: (collection: PostEntry["collection"]) => Promise<PostEntry[]>,
) {
  const perSection = await Promise.all(
    SECTION_SLUGS.map((slug) => load(SECTIONS[slug].collection)),
  )
  return perSection.flat()
}

export const getSectionPosts = () => collect(getAllPostsAndSubposts)

export async function getSectionPostsChrono() {
  const posts = await collect(getAllPostsAndSubpostsChrono)
  return posts.sort(newestFirst)
}
