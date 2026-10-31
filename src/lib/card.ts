import { COLLECTION_TO_SECTION, SECTIONS } from "@/consts"
import {
  getParentPost,
  getPostStats,
  isSubpost,
  postStatItems,
  type PostEntry,
} from "@/lib/data-utils"
import { canonicalizePathSegments } from "@/lib/site-utils"

export interface CardData {
  href: string
  title: string
  eyebrow?: string
  excerpt?: string
  date?: Date
  stats?: (string | false)[]
  series?: { href: string; title: string }
  tags?: string[]
}

export async function postCard(
  entry: PostEntry,
  showSectionLabel = true,
): Promise<CardData> {
  const { collection, data } = entry
  const section = SECTIONS[COLLECTION_TO_SECTION[collection]]
  const parent = isSubpost(entry.id)
    ? await getParentPost(entry.id, collection)
    : null
  const tags = data.tags ?? []
  return {
    href: canonicalizePathSegments(section.href, entry.id),
    title: data.title,
    eyebrow: showSectionLabel ? section.label : undefined,
    excerpt: data.description ?? "",
    date: data.date,
    stats: postStatItems(await getPostStats(entry)),
    series: parent
      ? {
          href: canonicalizePathSegments(section.href, parent.id),
          title: parent.data.title,
        }
      : undefined,
    tags: data.draft ? ["draft", ...tags] : tags,
  }
}
