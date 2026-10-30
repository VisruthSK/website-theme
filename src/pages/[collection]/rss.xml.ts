import { SECTION_SLUGS } from '@/consts'
import { buildSectionFeed } from '@/lib/feed'
import type { APIContext } from 'astro'

export const getStaticPaths = () =>
  SECTION_SLUGS.map((collection) => ({ params: { collection } }))

export const GET = (context: APIContext) =>
  buildSectionFeed(context, context.params.collection as string)
