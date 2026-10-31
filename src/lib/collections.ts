import { file, glob } from 'astro/loaders'
import { defineCollection, reference, type SchemaContext } from 'astro:content'
import { z } from 'astro/zod'
import theme from 'virtual:theme/config'

const postSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().optional(),
    description: z.string().optional(),
    order: z.array(z.string()).optional(),
    image: image().optional(),
    tags: z.array(z.string()).optional(),
    bib: z.string().optional(),
    rss: z.boolean().optional(),
    dropcap: z.boolean().optional(),
  })

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    description: z.string().optional(),
    draft: z.boolean().optional(),
  }),
})

const posts = (collection: string) =>
  defineCollection({
    loader: glob({ pattern: '**/*.md', base: `./src/content/${collection}` }),
    schema: postSchema,
  })

export const defineLedger = (path: string, link: string) =>
  defineCollection({
    loader: file(path),
    schema: z.strictObject({
      title: z.string(),
      creator: z.string().optional(),
      published: z.union([z.number(), z.string(), z.date()]).optional(),
      rating: z.union([z.int().min(1).max(10), z.literal('DNF')]).optional(),
      favorite: z.boolean().default(false),
      started: z.coerce.date().optional(),
      ended: z.coerce.date().optional(),
      added: z.coerce.date().optional(),
      note: z.string().optional(),
      feed: z.url().optional(),
      url: z.union([z.url(), z.string().startsWith('/')]).optional(),
      link: reference(link).optional(),
    }),
  })

export function defineCollections<
  Extra extends Record<string, ReturnType<typeof defineLedger>> = {},
>(
  extra?: Extra,
): Record<string, ReturnType<typeof posts>> & { pages: typeof pages } & Extra {
  return Object.assign(
    Object.fromEntries(
      theme.sections.map(({ collection }) => [collection, posts(collection)]),
    ),
    { pages },
    extra,
  ) as never
}
