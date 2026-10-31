import type { APIContext } from "astro"

import { renderLedgerFeed } from "@/lib/ledger-feed"

export const GET = (context: APIContext) =>
  renderLedgerFeed(
    context,
    [{ collection: "reading", href: "/reading/", noun: "Reading" }],
    { title: "Reading", description: "Reading" },
  )
