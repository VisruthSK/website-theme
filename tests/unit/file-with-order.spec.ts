import { expect, test } from "@playwright/test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { LoaderContext } from "astro/loaders"

import { fileWithOrder } from "../../src/lib/ledger-loader.ts"

const load = async (source: string) => {
  const dir = await mkdtemp(join(tmpdir(), "file-with-order-"))
  await writeFile(join(dir, "ledger.yaml"), source)
  const url = pathToFileURL(dir + "/")

  const entries = new Map<string, Record<string, unknown>>()
  const store = {
    get: (id: string) => entries.get(id),
    entries: () => [...entries],
    values: () => [...entries.values()],
    keys: () => [...entries.keys()],
    set: (entry: Record<string, unknown>) => {
      entries.set(entry.id as string, entry)
      return true
    },
    delete: (id: string) => entries.delete(id),
    clear: () => entries.clear(),
    has: (id: string) => entries.has(id),
    addModuleImport: () => undefined,
    addAssetImport: () => undefined,
    addAssetImports: () => undefined,
  }
  const meta = {
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
    has: () => false,
  }
  const logger = { debug() {}, info() {}, warn() {}, error() {} }
  const context = {
    collection: "test",
    store,
    meta,
    logger,
    config: { root: url },
    parseData: async ({ data: entryData }: { data: unknown }) => entryData,
    generateDigest: (entryData: unknown) => JSON.stringify(entryData),
  } as unknown as LoaderContext

  try {
    await fileWithOrder("ledger.yaml").load(context)
    return entries
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test("entries keep their 1-based file position", async () => {
  const entries = await load("a:\n  title: a\nb:\n  title: b\nc:\n  title: c\n")
  expect([...entries.keys()]).toEqual(["a", "b", "c"])
  expect(entries.get("a")?.data).toMatchObject({ order: 1 })
  expect(entries.get("b")?.data).toMatchObject({ order: 2 })
  expect(entries.get("c")?.data).toMatchObject({ order: 3 })
})

test("an entry with an explicit order keeps it", async () => {
  const entries = await load(
    "a:\n  title: a\nb:\n  title: b\n  order: 99\nc:\n  title: c\n",
  )
  expect(entries.get("a")?.data).toMatchObject({ order: 1 })
  expect(entries.get("b")?.data).toMatchObject({ order: 99 })
  expect(entries.get("c")?.data).toMatchObject({ order: 3 })
})
