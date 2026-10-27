import { parse as parseBibtex } from 'bibtex-parse'
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
  booktitle?: string
  organization?: string
}

export type Bibliography = Record<string, BibliographyEntry>

type BibtexEntry = {
  key?: string
  id?: string
  fields?: { name: string; value: string }[]
}

const cache = new Map<string, Bibliography>()

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim()

function toEntry(raw: unknown): BibliographyEntry {
  const { key, id, fields: list = [] } = raw as BibtexEntry
  const fields = Object.fromEntries(
    list.map(({ name, value }) => [name, collapse(value)]),
  )
  const field = (name: string) => fields[name] ?? ''

  return {
    key: key || id || '',
    author: field('author')
      .split(/\s+and\s+/i)
      .map((author) => author.trim())
      .filter(Boolean),
    title: field('title'),
    year: parseInt(field('year')) || new Date().getFullYear(),
    journal: field('journal'),
    publisher: field('publisher'),
    doi: field('doi'),
    pages: field('pages'),
    volume: field('volume'),
    issue: field('number') || field('issue'),
    url: field('url'),
    booktitle: field('booktitle'),
    organization: field('organization'),
  }
}

export function readBibliography(
  directory: string,
  bibName: string,
): Bibliography | null {
  const path = join(directory, `${bibName}.bib`)
  const cached = cache.get(path)
  if (cached) return cached

  try {
    const source = readFileSync(path, 'utf-8')
    const bibliography: Bibliography = {}
    for (const raw of parseBibtex(source)) {
      const entry = toEntry(raw)
      if (entry.key) bibliography[entry.key] = entry
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
