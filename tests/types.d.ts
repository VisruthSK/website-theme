declare module "wawoff2"

// Minimal mirror of astro:content for the pieces src/types.ts uses,
// so the tests can be type-checked without running `astro sync`.
declare module "astro:content" {
  export type CollectionKey = string
  export interface CollectionEntry<_C extends CollectionKey> {
    id: string
    collection: string
    body?: string
    data: { date: Date }
  }
}
