import { SITE } from "@/consts"
import { collectFeedEntries, renderFeed } from "@/lib/feed"
import type { APIContext } from "astro"

export async function GET(context: APIContext) {
  try {
    return renderFeed(context, {
      title: SITE.title,
      description: SITE.description,
      entries: await collectFeedEntries(),
    })
  } catch (error) {
    console.error("Error generating RSS feed:", error)
    return new Response("Error generating RSS feed", { status: 500 })
  }
}
