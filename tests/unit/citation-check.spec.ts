import { expect, test } from "@playwright/test"
import { findMissingCitations } from "../../src/integrations/citation-check.ts"

const pages: [string, string][] = [
  [
    "notes/everything/index.html",
    '<span class="citation-missing" data-citation-missing="nokey" title="Citation key not found: nokey">nokey?</span>',
  ],
  [
    "essays/index.html",
    '<span data-citation-missing="nokey">nokey?</span> <span data-citation-missing="other&amp;key">&amp;</span>',
  ],
  ["tags/index.html", "<p>no citations here</p>"],
]

test("unknown keys are reported with every page they appear on", () => {
  const missing = findMissingCitations(pages)
  expect([...missing]).toEqual([
    ["nokey", ["notes/everything/index.html", "essays/index.html"]],
    ["other&key", ["essays/index.html"]],
  ])
})

test("a page with no missing citations produces an empty report", () => {
  expect(findMissingCitations([["a.html", "<p>ok</p>"]]).size).toBe(0)
})
