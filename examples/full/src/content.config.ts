import { defineCollections, defineLedger } from '@/lib/collections'

export const collections = defineCollections({
  reading: defineLedger('src/data/reading.yaml', 'essays'),
})
