import { getCollection } from "astro:content"

import type { LedgerEntry } from "@/lib/ledger"

export const getLedger = async (collection: string) =>
  (await getCollection(collection as never)) as LedgerEntry[]
