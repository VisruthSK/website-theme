import type { CollectionKey } from 'astro:content'

export type ContentCollection = Exclude<CollectionKey, 'pages'>

export type SectionMetadata = {
  label: string
  href: string
  collection: ContentCollection
}
