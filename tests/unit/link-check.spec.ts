import { expect, test } from '@playwright/test'
import { redirectSources } from '../../src/integrations/link-check.ts'

test('redirect sources are read without comments, blanks or targets', () => {
  const sources = redirectSources(
    ['# moved', '', '/old   /new  301', '  /other /place'].join('\n'),
  )
  expect([...sources].sort()).toEqual(['/old', '/other'])
})

test('a percent-encoded source matches the decoded link', () => {
  const sources = redirectSources('/caf%C3%A9 /coffee 301\n/tea /tea-time')
  expect(sources.has('/café')).toBe(true)
  expect(sources.has('/tea')).toBe(true)
})

test('a malformed escape is kept as written', () => {
  expect(redirectSources('/100%/ /x').has('/100%/')).toBe(true)
})
