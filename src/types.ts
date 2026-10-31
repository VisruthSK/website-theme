import type { CollectionEntry, CollectionKey } from 'astro:content'

export type ContentCollection = {
  [K in CollectionKey]: CollectionEntry<K>['data'] extends { date: Date }
    ? K
    : never
}[CollectionKey]

export type SectionMetadata = {
  label: string
  href: string
  collection: ContentCollection
}
