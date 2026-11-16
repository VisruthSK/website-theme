import { file } from "astro/loaders"
import type { Loader, LoaderContext } from "astro/loaders"

interface ScopedEntry {
  id: string
  data?: Record<string, unknown>
}

const injectOrder = (entry: ScopedEntry, position: number): ScopedEntry =>
  entry.data && typeof entry.data === "object" && entry.data.order === undefined
    ? { ...entry, data: { ...entry.data, order: position } }
    : entry

/**
 * `file()` variant that stamps every entry with its 1-based position in the
 * file under `order`, unless the entry already declares one.
 *
 * Astro serialises the content store with entries sorted by id, so the order
 * the author arranged the YAML file in is lost by the time a page reads the
 * collection. Stamping the position here keeps that order available to
 * ledgers as `data.order`, where renderers can prefer it over the sorted
 * store order.
 */
export const fileWithOrder = (path: string): Loader => {
  const base = file(path)
  return {
    name: "ledger-file-with-order",
    load: (context: LoaderContext) => {
      let position = 0
      const originalSet = context.store.set.bind(context.store)
      const store = new Proxy(context.store, {
        get(target, property, receiver) {
          if (property === "set") {
            return (entry: ScopedEntry) =>
              originalSet(
                injectOrder(entry, (position += 1)) as Parameters<
                  typeof originalSet
                >[0],
              )
          }
          return Reflect.get(target, property, receiver)
        },
      })
      return base.load({ ...context, store })
    },
  }
}
