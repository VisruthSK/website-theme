import { readFile } from "node:fs/promises"
import { z } from "astro/zod"

const nonEmpty = z.string().min(1)
const remLength = z.string().regex(/^\d+(?:\.\d+)?rem$/)
const emLength = z.string().regex(/^\d+(?:\.\d+)?em$/)

const color = z.union([
  nonEmpty,
  z.strictObject({ light: nonEmpty, dark: nonEmpty }),
])

const BRAND_DEFAULTS = {
  background: { light: "#fcfcfc", dark: "#111111" },
  foreground: { light: "#202020", dark: "#eeeeee" },
  primary: { light: "#202020", dark: "#eeeeee" },
  secondary: { light: "#646464", dark: "#b4b4b4" },
  tertiary: { light: "#f0f0f0", dark: "#222222" },
  success: { light: "#218358", dark: "#3dd68c" },
  info: { light: "#0d74ce", dark: "#70b8ff" },
  warning: { light: "#ab6400", dark: "#ffca16" },
  danger: { light: "#ce2c31", dark: "#ff9592" },
} as const

const COLOR_DEFAULTS = {
  border: { light: "#d9d9d9", dark: "#3a3a3a" },
  ring: { light: "#838383", dark: "#7b7b7b" },
  "surface-hover": { light: "#f9f9f9", dark: "#191919" },
  highlight: "color-mix(in oklab, var(--warning) 25%, var(--background))",
  flourish: { light: "#646464", dark: "#b4b4b4" },
  "secondary-foreground": "var(--foreground)",
  "accent-foreground": "var(--foreground)",
  "primary-foreground": "var(--background)",
  destructive: "var(--danger)",
  "danger-hover": "var(--danger)",
  "danger-foreground": "var(--background)",
  "surface-accent-muted": "color-mix(in oklab, var(--accent) 15%, transparent)",
  "surface-accent-soft": "color-mix(in oklab, var(--accent) 40%, transparent)",
  "surface-warning": "color-mix(in oklab, var(--warning) 12%, transparent)",
  "highlight-border": "color-mix(in oklab, var(--warning) 40%, transparent)",
  "ink-faint": {
    light: "color-mix(in oklab, var(--foreground) 50%, transparent)",
    dark: "color-mix(in oklab, var(--foreground) 60%, transparent)",
  },
  "ink-muted": {
    light: "color-mix(in oklab, var(--foreground) 65%, transparent)",
    dark: "color-mix(in oklab, var(--foreground) 75%, transparent)",
  },
  "ink-subtle": {
    light: "color-mix(in oklab, var(--foreground) 75%, transparent)",
    dark: "color-mix(in oklab, var(--foreground) 82%, transparent)",
  },
  "ink-soft": {
    light: "color-mix(in oklab, var(--foreground) 85%, transparent)",
    dark: "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  "ink-strong": {
    light: "color-mix(in oklab, var(--foreground) 92%, transparent)",
    dark: "color-mix(in oklab, var(--foreground) 96%, transparent)",
  },
  "border-subtle": "color-mix(in oklab, var(--border) 80%, transparent)",
  "border-accent": "color-mix(in oklab, var(--accent) 60%, transparent)",
} as const

export const COLOR_TOKENS = [
  "background",
  "foreground",
  "primary",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "ring",
  "primary-foreground",
  "destructive",
  "danger",
  "danger-hover",
  "danger-foreground",
  "warning",
  "success",
  "info",
  "surface-hover",
  "surface-accent-muted",
  "surface-accent-soft",
  "surface-warning",
  "highlight",
  "highlight-border",
  "ink-faint",
  "ink-muted",
  "ink-subtle",
  "ink-soft",
  "ink-strong",
  "border-subtle",
  "border-accent",
  "flourish",
] as const

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/)

const colors = z
  .strictObject(
    Object.fromEntries(
      COLOR_TOKENS.map((token) => [token, color.optional()]),
    ) as Record<(typeof COLOR_TOKENS)[number], z.ZodOptional<typeof color>>,
  )
  .prefault({})

const brand = z
  .strictObject({
    palette: z.record(slug, nonEmpty).default({}),
    background: color.default(BRAND_DEFAULTS.background),
    foreground: color.default(BRAND_DEFAULTS.foreground),
    primary: color.default(BRAND_DEFAULTS.primary),
    secondary: color.default(BRAND_DEFAULTS.secondary),
    tertiary: color.default(BRAND_DEFAULTS.tertiary),
    success: color.default(BRAND_DEFAULTS.success),
    info: color.default(BRAND_DEFAULTS.info),
    warning: color.default(BRAND_DEFAULTS.warning),
    danger: color.default(BRAND_DEFAULTS.danger),
  })
  .prefault({})

type ColorToken = (typeof COLOR_TOKENS)[number]
type Brand = z.output<typeof brand>

type Color = z.output<typeof color>

const fromBrand = (roles: Brand) => ({
  background: roles.background,
  foreground: roles.foreground,
  primary: roles.primary,
  secondary: roles.tertiary,
  muted: roles.tertiary,
  accent: roles.tertiary,
  "muted-foreground": roles.secondary,
  success: roles.success,
  info: roles.info,
  warning: roles.warning,
  danger: roles.danger,
})

function resolveColors(
  explicit: Partial<Record<ColorToken, Color>>,
  roles: Brand,
) {
  const derived: Partial<Record<ColorToken, Color>> = fromBrand(roles)
  return Object.fromEntries(
    COLOR_TOKENS.map((token) => [
      token,
      explicit[token] ??
        derived[token] ??
        COLOR_DEFAULTS[token as keyof typeof COLOR_DEFAULTS],
    ]),
  ) as Record<ColorToken, Color>
}

function browserColors({ background, palette }: Brand) {
  const resolve = (mode: "light" | "dark") => {
    const value = typeof background === "string" ? background : background[mode]
    return palette[value] ?? value
  }
  return { light: resolve("light"), dark: resolve("dark") }
}

const fileName = z.string().regex(/^[^/\\]+\.(?:woff2|woff|ttf|otf)$/)

const face = z.strictObject({
  file: fileName,
  weight: z.int().min(1).max(1000).default(400),
  style: z.enum(["normal", "italic"]).default("normal"),
})

const fallback = (stack: string[]) => z.array(nonEmpty).default(stack)

const EMOJI = [
  "Apple Color Emoji",
  "Segoe UI Emoji",
  "Segoe UI Symbol",
  "Noto Color Emoji",
]

const family = (stack: string[]) =>
  z.strictObject({
    family: nonEmpty,
    fallback: fallback(stack),
    faces: z.array(face).min(1),
  })

const fonts = z.strictObject({
  directory: nonEmpty.default("src/assets/fonts"),
  stripHinting: z.boolean().default(false),
  body: family(["ui-serif", "system-ui", "serif", ...EMOJI]).extend({
    smallCaps: z.boolean().default(true),
  }),
  heading: family(["ui-sans-serif", "system-ui", "sans-serif", ...EMOJI]),
  mono: family([
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Monaco",
    "Consolas",
    "Courier New",
    "monospace",
  ]).optional(),
  math: z.strictObject({ family: nonEmpty, file: fileName }).optional(),
  dropCap: face
    .extend({
      family: nonEmpty,
      size: remLength.default("5.9rem"),
      tolerance: z.number().positive().default(0.35),
    })
    .optional(),
})

const link = z.strictObject({ href: nonEmpty, label: nonEmpty })

const features = z.strictObject({
  typeset: z.boolean().default(true),
  citations: z.boolean().default(true),
  marginNotes: z.boolean().default(true),
  math: z.boolean().default(true),
  callouts: z.boolean().default(true),
  dropCap: z.boolean().default(true),
  search: z.boolean().default(true),
  externalLinkIcons: z.boolean().default(true),
})

export const themeSchema = z
  .strictObject({
    $schema: z.string().optional(),
    site: z.strictObject({
      title: nonEmpty,
      description: z.string(),
      href: z.url(),
      author: nonEmpty,
      locale: nonEmpty.default("en-US"),
      dir: z.enum(["ltr", "rtl"]).default("ltr"),
      featuredPostCount: z.int().nonnegative().default(3),
      featured: z.array(z.string()).default([]),
    }),
    pages: z
      .strictObject({
        recent: z
          .strictObject({
            description: nonEmpty.default(
              "Every post in reverse chronological order.",
            ),
          })
          .prefault({}),
        search: z
          .strictObject({ placeholder: nonEmpty.default("Search") })
          .prefault({}),
      })
      .prefault({}),
    sections: z
      .array(
        z.strictObject({
          slug,
          label: nonEmpty,
          collection: z.string().regex(/^[a-z][a-z0-9_]*$/),
        }),
      )
      .min(1),
    navigation: z.array(z.union([z.strictObject({ section: slug }), link])),
    footer: z
      .strictObject({
        text: z.string().optional(),
        links: z.array(link.extend({ icon: slug })).default([]),
      })
      .prefault({}),
    brand,
    colors,
    fonts,
    prose: z
      .strictObject({
        fontSize: remLength.default("1.125rem"),
        lineHeight: remLength.default("1.75rem"),
        indent: emLength.default("1.35em"),
        dropCapMinWords: z.int().nonnegative().default(500),
      })
      .prefault({}),
    features: features.default({
      typeset: true,
      citations: true,
      marginNotes: true,
      math: true,
      callouts: true,
      dropCap: true,
      search: true,
      externalLinkIcons: true,
    }),
    bibliographies: nonEmpty.default("src/data/bibliographies"),
    unhinted: z
      .array(z.string().startsWith("/"))
      .default(["/_astro/*", "/pagefind/*"]),
  })
  .superRefine((theme, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message })
    const slugs = theme.sections.map((section) => section.slug)
    const collections = theme.sections.map((section) => section.collection)
    slugs.forEach((value, index) => {
      if (slugs.indexOf(value) !== index)
        issue(["sections", index, "slug"], `duplicate section ${value}`)
      if (collections.indexOf(collections[index]) !== index)
        issue(["sections", index, "collection"], "duplicate collection")
      if (collections[index] === "pages")
        issue(["sections", index, "collection"], '"pages" is reserved')
    })
    theme.navigation.forEach((item, index) => {
      if ("section" in item && !slugs.includes(item.section))
        issue(
          ["navigation", index, "section"],
          `unknown section ${item.section}`,
        )
    })
    if (theme.features.dropCap && !theme.fonts.dropCap)
      issue(["fonts", "dropCap"], "required while features.dropCap is true")
    if (theme.features.typeset) {
      const { faces } = theme.fonts.body
      if (
        !faces.some(({ weight, style }) => weight === 400 && style === "normal")
      )
        issue(["fonts", "body", "faces"], "typeset needs a regular 400 face")
    }
  })
  .transform((theme) => ({
    ...theme,
    colors: resolveColors(theme.colors, theme.brand),
    browserColors: browserColors(theme.brand),
  }))

export type Theme = z.output<typeof themeSchema>

export function parseTheme(input: unknown): Theme {
  const result = themeSchema.safeParse(input)
  if (result.success) return result.data
  const problems = result.error.issues.map(
    ({ path, message }) => `  ${path.join(".") || "(root)"}: ${message}`,
  )
  throw new Error(`Invalid theme.json:\n${problems.join("\n")}`)
}

export async function loadTheme(file: URL): Promise<Theme> {
  return parseTheme(JSON.parse(await readFile(file, "utf8")))
}
