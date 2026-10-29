import { Cite } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface BibliographyEntry {
  key: string
  author: string[]
  title: string
  year: number
  url?: string
  journal?: string
  publisher?: string
  doi?: string
  pages?: string
  volume?: string
  issue?: string
}

export type Bibliography = Record<string, BibliographyEntry>

interface CslName {
  family?: string
  given?: string
  literal?: string
}

interface CslItem {
  id: string
  author?: CslName[]
  title?: string
  issued?: { 'date-parts'?: number[][] }
  'container-title'?: string
  publisher?: string
  DOI?: string
  URL?: string
  page?: string
  volume?: string
  issue?: string
}

const cache = new Map<string, Bibliography>()

const name = ({ family, given, literal }: CslName) =>
  literal ?? [family, given].filter(Boolean).join(', ')

const toEntry = (item: CslItem): BibliographyEntry => ({
  key: item.id,
  author: (item.author ?? []).map(name),
  title: item.title ?? '',
  year: item.issued?.['date-parts']?.[0]?.[0] ?? new Date().getFullYear(),
  journal: item['container-title'],
  publisher: item.publisher,
  doi: item.DOI,
  pages: item.page?.replace('-', '–'),
  volume: item.volume,
  issue: item.issue,
  url: item.URL,
})

export function readBibliography(
  directory: string,
  bibName: string,
): Bibliography | null {
  const path = join(directory, `${bibName}.bib`)
  const cached = cache.get(path)
  if (cached) return cached

  try {
    const bibliography: Bibliography = {}
    for (const item of new Cite(readFileSync(path, 'utf-8'))
      .data as CslItem[]) {
      bibliography[item.id] = toEntry(item)
    }
    cache.set(path, bibliography)
    return bibliography
  } catch (error) {
    console.warn(`Bibliography file not found: ${bibName}.bib`, error)
    return null
  }
}

export function formatAuthors(authors: string[], maxAuthors = 3): string {
  if (authors.length === 0) return 'Unknown'
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`
  if (authors.length <= maxAuthors) {
    return `${authors.slice(0, -1).join(', ')}, & ${authors.at(-1)}`
  }
  return `${authors[0]} et al.`
}

export function formatReference(entry: BibliographyEntry): string {
  const venue = entry.journal
    ? [
        entry.journal,
        entry.volume && entry.issue
          ? `${entry.volume}(${entry.issue})`
          : entry.volume,
        entry.pages,
      ]
        .filter(Boolean)
        .join(', ')
    : entry.publisher
  return [
    `${formatAuthors(entry.author)} (${entry.year}).`,
    `${entry.title}.`,
    venue && `${venue}.`,
  ]
    .filter(Boolean)
    .join(' ')
}
