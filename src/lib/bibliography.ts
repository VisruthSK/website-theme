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

const typeset = (value: string) =>
  value.replace(/[{}]/g, '').replace(/---/g, '—').replace(/--/g, '–')

function splitAuthors(value: string): string[] {
  const authors: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '{') depth += 1
    else if (value[index] === '}') depth -= 1
    else if (depth === 0) {
      const separator = /^\s+and\s+/i.exec(value.slice(index))
      if (separator) {
        authors.push(value.slice(start, index))
        index += separator[0].length - 1
        start = index + 1
      }
    }
  }
  authors.push(value.slice(start))
  return authors.map((author) => typeset(author.trim())).filter(Boolean)
}

function toEntry(raw: unknown): BibliographyEntry {
  const { key, id, fields: list = [] } = raw as BibtexEntry
  const fields = Object.fromEntries(
    list.map(({ name, value }) => [name, collapse(value)]),
  )
  const field = (name: string) => fields[name] ?? ''
  const text = (name: string) => typeset(field(name))

  return {
    key: key || id || '',
    author: splitAuthors(field('author')),
    title: text('title'),
    year: parseInt(field('year')) || new Date().getFullYear(),
    journal: text('journal'),
    publisher: text('publisher'),
    doi: field('doi'),
    pages: text('pages'),
    volume: text('volume'),
    issue: typeset(field('number') || field('issue')),
    url: field('url'),
    booktitle: text('booktitle'),
    organization: text('organization'),
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
