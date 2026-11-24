import { expect, test } from "@playwright/test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  formatReference,
  formatShortAuthors,
  readBibliography,
  sortEntriesByAuthorYear,
} from "../../src/lib/bibliography.ts"

const directory = mkdtempSync(join(tmpdir(), "bibliography-"))
const sample = join(directory, "sample.bib")
writeFileSync(
  sample,
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

const entry = readBibliography(sample)!.one

test("brace protection is removed from names and titles", () => {
  expect(entry.author).toEqual([
    "R Core Team",
    "Knuth, Donald E.",
    "Smith and Sons",
  ])
  expect(entry.title).toBe("The TeXbook — a Book")
})

test("short author lists for author-year citations", () => {
  expect(formatShortAuthors(["Knuth, Donald E."])).toBe("Knuth")
  expect(formatShortAuthors(["Knuth, Donald E.", "Plass, Michael F."])).toBe(
    "Knuth & Plass",
  )
  expect(
    formatShortAuthors([
      "Knuth, Donald E.",
      "Plass, Michael F.",
      "Smith, Jane",
    ]),
  ).toBe("Knuth, Plass & Smith")
  expect(
    formatShortAuthors([
      "Knuth, Donald E.",
      "Plass, Michael F.",
      "Smith, Jane",
      "Doe, John",
    ]),
  ).toBe("Knuth et al.")
})

test("author-year entries sort by first author, then year, then title", () => {
  const sorted = sortEntriesByAuthorYear([
    { key: "b", author: ["Beta, A."], title: "Beta", year: 2001 },
    { key: "a2", author: ["Alpha, B."], title: "Second", year: 1990 },
    { key: "a1", author: ["Alpha, A."], title: "First", year: 2000 },
    { key: "a1b", author: ["Alpha, A."], title: "First", year: 1990 },
  ])
  expect(sorted.map(({ key }) => key)).toEqual(["a1b", "a1", "a2", "b"])
})

test("page ranges use an en dash", () => {
  expect(entry.pages).toBe("1119–1184")
})

test("identifiers and addresses are left exactly as written", () => {
  expect(entry.doi).toBe("10.1000/a--b")
  expect(entry.url).toBe("https://example.org/a--b")
})

test("an entry without a year has none and is formatted as undated", () => {
  const file = join(directory, "undated.bib")
  writeFileSync(file, "@book{x, author = {Someone, A.}, title = {Untitled}}")
  const undated = readBibliography(file)!.x
  expect(undated.year).toBeUndefined()
  expect(formatReference(undated)).toContain("(n.d.)")
})
