import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  formatReference,
  readBibliography,
} from '../../src/lib/bibliography.ts'

const directory = mkdtempSync(join(tmpdir(), 'bibliography-'))
writeFileSync(
  join(directory, 'sample.bib'),
  `@article{one,
  author = {{R Core Team} and Knuth, Donald E. and {Smith and Sons}},
  title = {The {TeX}book --- a {B}ook},
  journal = {Journal},
  year = {1984},
  pages = {1119--1184},
  doi = {10.1000/a--b},
  url = {https://example.org/a--b}
}`,
)

const entry = readBibliography(directory, 'sample')!.one

test('brace protection is removed from names and titles', () => {
  expect(entry.author).toEqual([
    'R Core Team',
    'Knuth, Donald E.',
    'Smith and Sons',
  ])
  expect(entry.title).toBe('The TeXbook — a Book')
})

test('page ranges use an en dash', () => {
  expect(entry.pages).toBe('1119–1184')
})

test('identifiers and addresses are left exactly as written', () => {
  expect(entry.doi).toBe('10.1000/a--b')
  expect(entry.url).toBe('https://example.org/a--b')
})

test('an entry without a year has none and is formatted as undated', () => {
  writeFileSync(
    join(directory, 'undated.bib'),
    '@book{x, author = {Someone, A.}, title = {Untitled}}',
  )
  const undated = readBibliography(directory, 'undated')!.x
  expect(undated.year).toBeUndefined()
  expect(formatReference(undated)).toContain('(n.d.)')
})
