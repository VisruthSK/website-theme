import type { APIContext } from "astro"

import { SITE } from "@/consts"
import { withBase } from "@/lib/base"
import { resolveSiteUrl } from "@/lib/content-render"
import { respondWithFeed } from "@/lib/feed"
import { ledgerPermalinks } from "@/lib/ledger"
import { getLedger } from "@/lib/ledger-entries"
import { renderLedgerNote } from "@/lib/ledger-note"

interface LedgerSource {
  collection: string
  href: string
  noun: string
}

const plainText = (markdown: string) =>
  markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[_*]/g, "")
    .replace(/\s+/g, " ")
    .trim()

export async function renderLedgerFeed(
  context: APIContext,
  sources: LedgerSource[],
  { title, description }: { title: string; description: string },
) {
  const site = resolveSiteUrl(context, SITE.href)
  const absolutize = (html: string) =>
    html.replaceAll('href="/', `href="${site}/`)

  const items = (
    await Promise.all(
      sources.map(async ({ collection, href, noun }) => {
        const entries = await getLedger(collection)
        const permalinks = ledgerPermalinks(entries)
        return entries.map(({ id, data }) => {
          const rating =
            data.rating === "DNF" ? "DNF" : data.rating && `${data.rating}/10`
          return {
            title: data.title,
            link: `${withBase(href)}#${permalinks.get(id)}`,
            pubDate: data.ended ?? data.added,
            categories: [noun],
            author: data.creator,
            description: [
              rating && `Rating: ${rating}.`,
              plainText(data.note ?? ""),
            ]
              .filter(Boolean)
              .join(" "),
            content: absolutize(
              [
                data.creator || rating
                  ? `<p>${[data.creator, rating].filter(Boolean).join(" · ")}</p>`
                  : "",
                data.url
                  ? `<p><a href="${withBase(data.url)}">${data.title}</a></p>`
                  : "",
                data.note ? renderLedgerNote(data.note) : "",
              ].join(""),
            ),
          }
        })
      }),
    )
  ).flat()

  return respondWithFeed(context, {
    title,
    description,
    items,
    trailingSlash: false,
  })
}
