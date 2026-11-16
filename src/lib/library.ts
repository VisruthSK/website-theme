export const LIBRARY_DESCRIPTION =
  "Books, papers, blogs, posters, slides, and open-source projects."

export interface ShelfConfig {
  label: string
  noun: string
  title?: string
  description?: string
  linkLabel?: string
  linkTitle?: boolean
  ratings?: boolean
  dated?: boolean
  searchable?: boolean
}

export const shelves = {
  books: {
    label: "Books",
    noun: "Book",
    description:
      "Some books I've read, sometimes with short, spoiler-free notes and occasionally with longer (typically spoiler) reviews.",
    linkLabel: "Review",
    ratings: true,
    dated: true,
  },
  papers: {
    label: "Papers",
    noun: "Paper",
    description: "Some papers I rather like.",
    linkLabel: "Review",
    dated: false,
  },
  posters: { label: "Posters", noun: "Poster", dated: true },
  slides: { label: "Slides", noun: "Slides", dated: true },
  projects: {
    label: "Projects",
    noun: "Project",
    description: "Open source projects.",
    dated: false,
    searchable: false,
    linkTitle: false,
  },
  blogroll: {
    label: "Blogroll",
    noun: "Blog",
    description: "Selected blogs I read.",
    dated: false,
    searchable: false,
    linkTitle: false,
  },
} as const satisfies Record<string, ShelfConfig>

export type Shelf = keyof typeof shelves

export const shelfHref = (shelf: Shelf) => `/library/${shelf}`

export const shelfSource = (shelf: Shelf) => ({
  collection: shelf,
  href: `${shelfHref(shelf)}/`,
  noun: shelves[shelf].noun,
})

export const shelfFeed = (shelf: Shelf) => ({
  href: `${shelfHref(shelf)}/feed.xml`,
  label: `${shelves[shelf].label} RSS feed`,
})

export const libraryFeed = {
  href: "/library/feed.xml",
  label: "Library RSS feed",
}

export const shelfEntries = (Object.keys(shelves) as Shelf[]).map(
  (shelf) =>
    ({
      shelf,
      ...shelves[shelf],
    }) as const,
)

export const shelfSources = shelfEntries.map(({ shelf }) =>
  shelfSource(shelf),
)

export const recentlyAddedSources = [...shelfSources]

