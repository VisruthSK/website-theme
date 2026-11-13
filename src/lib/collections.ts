import { file, glob } from "astro/loaders"
import { defineCollection, reference, type SchemaContext } from "astro:content"
import { z } from "astro/zod"
import theme from "virtual:theme/config"
import type { LedgerEntry } from "./ledger"

const postSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().optional(),
    description: z.string().optional(),
    order: z.array(z.string()).optional(),
    image: image().optional(),
    tags: z.array(z.string()).optional(),
    rss: z.boolean().optional(),
    dropcap: z.boolean().optional(),
  })

const pages = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    description: z.string().optional(),
    draft: z.boolean().optional(),
  }),
})

const posts = (collection: string) =>
  defineCollection({
    loader: glob({ pattern: "**/*.md", base: `./src/content/${collection}` }),
    schema: postSchema,
  })

export interface LedgerOptions {
  /**
   * Field names every entry must supply; missing ones are build errors.
   * `link` is excluded — it is validated as a reference when configured.
   */
  required?: readonly Exclude<keyof LedgerEntry["data"], "link">[]
}

export function defineLedgerSchema() {
  return z.strictObject({
    title: z.string(),
    creator: z.string().optional(),
    published: z.union([z.number(), z.string(), z.date()]).optional(),
    rating: z.union([z.int().min(1).max(10), z.literal("DNF")]).optional(),
    favorite: z.boolean().default(false),
    started: z.coerce.date().optional(),
    ended: z.coerce.date().optional(),
    added: z.coerce.date().optional(),
    note: z.string().optional(),
    feed: z.url().optional(),
    url: z.union([z.url(), z.string().startsWith("/")]).optional(),
    repo: z.url().optional(),
    tags: z.array(z.string().min(1)).optional(),
    role: z.string().optional(),
    description: z.string().optional(),
  })
}

function withRequired<S extends z.ZodType>(
  schema: S,
  required: readonly string[],
) {
  return schema.superRefine((data: unknown, context) => {
    const fields = data as Record<string, unknown>
    for (const key of required) {
      if (fields[key] === undefined) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `missing required field ${String(key)}`,
        })
      }
    }
  })
}

export const defineLedger = (
  path: string,
  link?: string,
  options: LedgerOptions = {},
) => {
  const base = withRequired(defineLedgerSchema(), options.required ?? [])
  const schema = link
    ? base.extend({ link: reference(link).optional() })
    : base
  return defineCollection({ loader: file(path), schema })
}

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
