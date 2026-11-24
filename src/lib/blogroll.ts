import { getCollection } from "astro:content"

import type { LedgerEntry } from "@/lib/ledger"

const sortKey = (title: string) => title.replace(/^[^\p{L}\p{N}]+/u, "")

export const getBlogs = async () =>
  ((await getCollection("blogroll" as never)) as LedgerEntry[]).toSorted(
    (a, b) =>
      sortKey(a.data.title).localeCompare(sortKey(b.data.title), undefined, {
        sensitivity: "base",
        ignorePunctuation: true,
      }),
  )
