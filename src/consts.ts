import theme, { paths } from 'virtual:erudite/config'
import { icons } from 'virtual:erudite/assets'
import { withBase } from '@/lib/base'
import type { ContentCollection, SectionMetadata } from '@/types'

export const SITE = theme.site
export const TEXT = theme.text
export const FEATURES = theme.features

export const FEATURED_POST_IDS: string[] = theme.site.featured

export const SECTIONS: Record<string, SectionMetadata> = Object.fromEntries(
  theme.sections.map(({ slug, label, collection }) => [
    slug,
    {
      label,
      href: withBase(`/${slug}`),
      collection: collection as ContentCollection,
    },
  ]),
)

export type SectionSlug = string
export const SECTION_SLUGS: SectionSlug[] = theme.sections.map(
  ({ slug }) => slug,
)
export const COLLECTION_TO_SECTION: Record<string, SectionSlug> =
  Object.fromEntries(
    theme.sections.map(({ slug, collection }) => [collection, slug]),
  )

export const NAVIGATION = theme.navigation.map((item) =>
  'section' in item
    ? { href: SECTIONS[item.section].href, label: SECTIONS[item.section].label }
    : { ...item, href: withBase(item.href) },
)

export const SOCIALS = theme.socials.map(({ icon, ...link }) => ({
  ...link,
  href: withBase(link.href),
  icon: icons[icon],
}))

export const PATHS = paths
