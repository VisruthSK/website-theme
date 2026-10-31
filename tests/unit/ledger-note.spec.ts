import { expect, test } from '@playwright/test'
import { renderLedgerNote } from '../../src/lib/ledger-note'

test('renders note Markdown and paragraphs', () => {
  expect(
    renderLedgerNote('A *book* and **another**.\n\nSecond paragraph.'),
  ).toBe(
    '<p>A <em>book</em> and <strong>another</strong>.</p>\n<p>Second paragraph.</p>\n',
  )
})

test('renders Markdown hyperlinks', () => {
  expect(
    renderLedgerNote('Read [the article](https://example.com/).'),
  ).toContain('<a href="https://example.com/">the article</a>')
})
