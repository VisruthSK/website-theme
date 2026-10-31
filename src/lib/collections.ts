import { glob } from 'astro/loaders'
import { defineCollection, type SchemaContext } from 'astro:content'
import { z } from 'astro/zod'
import theme from 'virtual:erudite/config'

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

export function defineCollections(): Record<
  string,
  ReturnType<typeof posts>
> & { pages: typeof pages } {
  return Object.assign(
    Object.fromEntries(
      theme.sections.map(({ collection }) => [collection, posts(collection)]),
    ),
    { pages },
  )
}
