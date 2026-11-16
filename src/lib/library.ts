export const LIBRARY_DESCRIPTION =
  "Books, papers, blogs, posters, slides, and open-source projects."

export const shelves = {
  books: { label: "Books", noun: "Book" },
  papers: { label: "Papers", noun: "Paper" },
  posters: { label: "Posters", noun: "Poster" },
  slides: { label: "Slides", noun: "Slides" },
  projects: { label: "Projects", noun: "Project" },
} as const

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

export const shelfSources = (Object.keys(shelves) as Shelf[]).map(shelfSource)

export const recentlyAddedSources = [
  ...shelfSources,
  { collection: "blogroll", href: "/library/blogroll", noun: "Blog" },
]
