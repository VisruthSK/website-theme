import { writeFile } from 'node:fs/promises'
import { z } from 'astro/zod'
import { themeSchema } from '../config/theme.ts'

const schema = z.toJSONSchema(themeSchema, { io: 'input' })
await writeFile(
  new URL('../config/theme.schema.json', import.meta.url),
  `${JSON.stringify(schema, null, 2)}\n`,
)
