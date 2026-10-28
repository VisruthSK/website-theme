import { expect, test } from '@playwright/test'
import { arrangeStyles, wrapPageStyle } from '../../src/lib/page-styles.ts'
import { themeCss } from '../../src/integrations/theme-css.ts'
import { SITES } from '../sites.ts'

const layout = [
  'a{}',
  wrapPageStyle('article', 'b{}'),
  'c{}',
  wrapPageStyle('math', 'd{}'),
  wrapPageStyle('article', 'e{}'),
  wrapPageStyle('search', 'f{}'),
].join('')

const stems = (html: string) =>
  arrangeStyles(['pre{}', layout, 'post{}'], html).map(
    ({ stem, css }) => `${stem}:${css}`,
  )

test('listings keep only the base rules', () => {
  expect(stems('<main></main>')).toEqual([
    'pre:pre{}',
    'base:a{}c{}',
    'route:post{}',
  ])
})

test('articles add their rules in source order, and maths and search only where used', () => {
  expect(stems('<prose-content>')).toEqual([
    'pre:pre{}',
    'base:a{}c{}',
    'article:b{}e{}',
    'route:post{}',
  ])
  expect(stems('<prose-content><math>')).toContain('math:d{}')
  expect(stems('<search-page>')).toContain('search:f{}')
  expect(stems('<prose-content>')).not.toContain('math:d{}')
})

test('the same section produces the same file for every page', () => {
  const [, base] = arrangeStyles(['pre{}', layout], '<main>')
  const [, again] = arrangeStyles(['pre{}', layout], '<prose-content>')
  expect(base).toEqual(again)
})

test.describe('page style blocks', () => {
  const { transform } = themeCss(SITES.example.theme)

  test('@when wraps its block in markers', () => {
    const output = transform('@when search { a { color: red; } }', '/x/a.css')
    expect(output).toBe(wrapPageStyle('search', ' a { color: red; } '))
  })

  test('a stylesheet named in the table is wrapped whole', () => {
    expect(transform('a{}', '/x/styles/typography-math.css')).toBe(
      wrapPageStyle('math', 'a{}'),
    )
  })

  test('an unknown name is rejected', () => {
    expect(() => transform('@when nowhere { a {} }', '/x/a.css')).toThrow(
      'Unknown page style nowhere',
    )
  })
})
