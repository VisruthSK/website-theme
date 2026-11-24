import type { LedgerLinkIcon } from "./ledger-icons"
import { groupByYear } from "./group"

export interface LedgerEntry {
  id: string
  data: {
    title: string
    creator?: string
    published?: Date | string | number
    rating?: number | "DNF"
    favorite: boolean
    started?: Date
    ended?: Date
    added?: Date
    note?: string
    url?: string
    repo?: string
    tags?: string[]
    role?: string
    description?: string
    order?: number
    feed?: string
    links?: { label?: string; url: string; icon: LedgerLinkIcon }[]
    link?: { collection: string; id: string }
  }
}

const UNDATED = Number.MAX_SAFE_INTEGER

export const sortByOrder = <T extends LedgerEntry>(entries: T[]) =>
  entries.toSorted(
    (a, b) => (a.data.order ?? UNDATED) - (b.data.order ?? UNDATED),
  )

const ledgerDate = ({ data }: LedgerEntry) =>
  data.ended ?? (data.rating === "DNF" ? data.started : undefined) ?? data.added

export const addedDate = (entry: LedgerEntry) =>
  entry.data.added ?? ledgerDate(entry)

const endedTime = (entry: LedgerEntry) =>
  ledgerDate(entry)?.valueOf() ?? UNDATED

export const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const ledgerGroups = <T extends LedgerEntry>(entries: T[]) =>
  groupByYear(entries, ledgerDate, (a, b) => endedTime(b) - endedTime(a)).map(
    (group) =>
      group.heading === "Undated"
        ? { ...group, entries: sortByOrder(group.entries) }
        : group,
  )

export function ledgerPermalinks(entries: LedgerEntry[]) {
  const counts = new Map<string, number>()
  return new Map(
    entries
      .toSorted((a, b) => endedTime(a) - endedTime(b))
      .map(({ id, data }) => {
        const base = slugify(data.title)
        const count = (counts.get(base) ?? 0) + 1
        counts.set(base, count)
        return [id, `${base}-${String(count).padStart(2, "0")}`] as const
      }),
  )
}

export function dateRange(started?: Date, ended?: Date) {
  const only = ended ?? started
  if (!started || !ended || started.valueOf() === ended.valueOf()) {
    return { dates: only ? [only] : [], open: Boolean(started && !ended) }
  }
  return { dates: [started, ended], open: false }
}
