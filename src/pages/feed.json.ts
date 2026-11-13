import { SITE } from "@/consts"
import { collectFeedEntries, renderJsonFeed } from "@/lib/feed"
import type { APIContext } from "astro"

export async function GET(context: APIContext) {
  try {
    return renderJsonFeed(context, {
      title: SITE.title,
      description: SITE.description,
      entries: await collectFeedEntries(),
    })
  } catch (error) {
    console.error("Error generating JSON feed:", error)
    return new Response("Error generating JSON feed", { status: 500 })
  }
}
