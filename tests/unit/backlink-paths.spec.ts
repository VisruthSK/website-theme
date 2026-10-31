import { expect, test } from '@playwright/test'
import { linkedPaths } from '../../src/lib/backlink-paths'

test('finds and deduplicates internal links using the source URL', () => {
  const html = `<a href="../other/">first</a><a href="../other/#note">again</a>
    <a href="https://elsewhere.example/other/">external</a><code>[fake](/fake/)</code>`
  expect([
    ...linkedPaths(html, '/base/posts/source/', 'https://example.com'),
  ]).toEqual(['/base/posts/other'])
})
