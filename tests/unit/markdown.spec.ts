import { expect, test } from '@playwright/test'
import { markdownToHtml } from 'satteri'
import { baseLinks } from '../../src/lib/markdown/base-links.ts'
import { cite, extractCitedKeys } from '../../src/lib/markdown/cite.ts'
import { dashes } from '../../src/lib/markdown/dashes.ts'
import { externalLinks } from '../../src/lib/markdown/external-links.ts'
import { footnoteSentences } from '../../src/lib/markdown/footnote-sentences.ts'
import { footnotes } from '../../src/lib/markdown/footnotes.ts'
import { opening } from '../../src/lib/markdown/opening.ts'

const astro = (frontmatter: Record<string, unknown> = {}) => ({
  astro: {
    frontmatter,
    headings: [],
    localImagePaths: new Set<string>(),
    remoteImagePaths: new Set<string>(),
  },
})

const citations = cite('examples/full/src/data/bibliographies')

const render = (
  source: string,
  options: Omit<Parameters<typeof markdownToHtml>[1], 'data'> = {},
  frontmatter: Record<string, unknown> = {},
) => markdownToHtml(source, { ...options, data: astro(frontmatter) }).html

const cited = (source: string) =>
  render(source, { mdastPlugins: [citations] }, { bib: 'example' })

const numbers = (html: string) =>
  [...html.matchAll(/class="citation-link"[^>]*>(\d+)</g)].map(([, n]) => n)

test.describe('citations', () => {
  test('@key renders a numbered link with a preview', () => {
    const html = cited('As measured by @knuth1981.')
    expect(html).toContain('<span class="citation">[<a href="#ref-knuth1981"')
    expect(html).toContain(
      'data-citation-preview="Knuth, Donald E. &amp; Plass, Michael F. (1981).',
    )
    expect(numbers(html)).toEqual(['1'])
  })

  test('groups keep citation order and stable numbers', () => {
    expect(numbers(cited('Both [@knuth1984; @knuth1981] agree.'))).toEqual([
      '1',
      '2',
    ])
    expect(
      numbers(cited('First @knuth1984, then @wilde1888, again [@knuth1984].')),
    ).toEqual(['1', '2', '1'])
  })

  test('prefixes, locators and suppressed authors are kept', () => {
    const html = cited('See [see @knuth1984, p. 14; -@wilde1888].')
    expect(html).toContain('see <a href="#ref-knuth1984"')
    expect(html).toContain('</a>, p. 14')
    expect(numbers(html)).toEqual(['1', '2'])
  })

  test('addresses are ignored and unknown keys are flagged', () => {
    expect(cited('Write to someone@example.com.')).not.toContain('citation')
    expect(cited('Unknown @nokey here.')).toContain('citation-missing')
  })

  test('posts without a bibliography are untouched', () => {
    expect(
      render('As @knuth1981 says.', { mdastPlugins: [citations] }),
    ).not.toContain('citation')
  })

  test('cited keys are extracted in order of first use', () => {
    expect(extractCitedKeys('[@b; @a] and @b')).toEqual(['b', 'a'])
  })
})

test('double hyphens become em dashes', () => {
  expect(render('one--two', { mdastPlugins: [dashes] })).toContain('one—two')
})

test.describe('base links', () => {
  const html = render(
    '[a](/essays/) ![b](/img/x.png) [c](https://x.org/) [d](//cdn.x.org/y) [e](/site/essays/) [f](#top) [g](relative/)',
    { hastPlugins: [baseLinks('/site')] },
  )

  test('root-relative links and images gain the base', () => {
    expect(html).toContain('href="/site/essays/"')
    expect(html).toContain('src="/site/img/x.png"')
  })

  test('absolute, protocol-relative, prefixed and relative ones are left alone', () => {
    expect(html).toContain('href="https://x.org/"')
    expect(html).toContain('href="//cdn.x.org/y"')
    expect(html).toContain('href="/site/essays/"')
    expect(html).not.toContain('/site/site')
    expect(html).toContain('href="#top"')
    expect(html).toContain('href="relative/"')
  })
})

test.describe('external links', () => {
  const source =
    '[out](https://example.org/) [home](https://www.example.com/a) [rel](/b)'

  test('external links open in a new tab with an icon', () => {
    const html = render(source, {
      hastPlugins: [externalLinks('https://example.com/', true)],
    })
    expect(html).toMatch(
      /<a href="https:\/\/example\.org\/" target="_blank" rel="noopener noreferrer"/,
    )
    expect(html.match(/external-link-icon-wrap/g)).toHaveLength(1)
    expect(html).not.toMatch(/example\.com\/a" target/)
  })

  test('icons can be switched off', () => {
    const html = render(source, {
      hastPlugins: [externalLinks('https://example.com/', false)],
    })
    expect(html).toContain('target="_blank"')
    expect(html).not.toContain('external-link-icon')
  })
})

test.describe('footnotes', () => {
  const source =
    'A sentence. Another one with a note.[^1] A third.\n\n[^1]: The note.'

  test('margin notes repeat the note beside the paragraph', () => {
    const html = render(source, {
      mdastPlugins: [footnoteSentences],
      hastPlugins: [footnotes(true)],
    })
    expect(html).toContain('<side-note role="note" aria-label="Footnote 1"')
    expect(html).toContain('</a> The note.</side-note>')
    expect(html).toContain('<h2 id="footnotes">Footnotes')
    expect(html).toContain(
      '<span class="footnote-sentence">Another one with a note.',
    )
    expect(html).not.toContain('<span class="footnote-sentence">A sentence.')
  })

  test('without margin notes only the footnotes section remains', () => {
    const html = render(source, { hastPlugins: [footnotes(false)] })
    expect(html).not.toContain('side-note')
    expect(html).toContain('<h2 id="footnotes">Footnotes')
    expect(html).toContain('footnote-backref')
  })
})

test.describe('opening', () => {
  const long = (words: number) =>
    Array.from({ length: words }, (_, i) => `word${i}`).join(' ')

  test('long posts get a drop cap and opening words', () => {
    const html = render(long(600), { hastPlugins: [opening(true)] })
    expect(html).toContain('<span class="drop-cap">w</span>')
    expect(html).toContain('<span class="opening-words">ord0 word1</span>')
  })

  test('the word cutoff is configurable', () => {
    expect(render(long(100), { hastPlugins: [opening(true, 50)] })).toContain(
      'drop-cap',
    )
  })

  test('short posts, dropcap: false and the switch leave it out', () => {
    expect(render(long(100), { hastPlugins: [opening(true)] })).not.toContain(
      'drop-cap',
    )
    expect(
      render(long(600), { hastPlugins: [opening(true)] }, { dropcap: false }),
    ).not.toContain('drop-cap')
    expect(render(long(600), { hastPlugins: [opening(false)] })).not.toContain(
      'drop-cap',
    )
  })

  test('a short preamble before a rule is marked', () => {
    const html = render(`Intro.\n\nMore intro.\n\n---\n\n${long(600)}`, {
      hastPlugins: [opening(true)],
    })
    expect(html.match(/class="preamble"/g)).toHaveLength(2)
  })
})
