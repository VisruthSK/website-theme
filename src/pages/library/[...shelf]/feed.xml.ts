import { SITE } from "@/consts"
import { renderLedgerFeed } from "@/lib/ledger-feed"
import {
  LIBRARY_DESCRIPTION,
  shelfSource,
  shelfSources,
  shelves,
  type Shelf,
} from "@/lib/library"
import type { APIContext } from "astro"

export const getStaticPaths = () => [
  { params: { shelf: undefined } },
  ...Object.keys(shelves).map((shelf) => ({ params: { shelf } })),
]

export const GET = (context: APIContext) => {
  const shelf = context.params.shelf as Shelf | undefined
  const label = shelf ? shelves[shelf].label : "Library"
  return renderLedgerFeed(
    context,
    shelf ? [shelfSource(shelf)] : shelfSources,
    {
      title: `${SITE.title} - ${label}`,
      description: shelf ? label : LIBRARY_DESCRIPTION,
    },
  )
}
