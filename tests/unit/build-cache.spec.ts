import { expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  buildCache,
  digest,
  libraryVersions,
} from '../../src/lib/build-cache.ts'

const root = () =>
  pathToFileURL(`${mkdtempSync(join(tmpdir(), 'build-cache-'))}/`)

test('a value is read back by its key and missing keys are empty', async () => {
  const cache = buildCache(root(), 'edges')
  await cache.write('a'.repeat(20), 'first')
  expect((await cache.read('a'.repeat(20)))?.toString()).toBe('first')
  expect(await cache.read('b'.repeat(20))).toBeUndefined()
})

test('writing a new key removes only the old entries of the same kind', async () => {
  const directory = root()
  const edges = buildCache(directory, 'edges')
  const edgesItalic = buildCache(directory, 'edges-italic')
  await edgesItalic.write('c'.repeat(20), 'italic')
  await edges.write('a'.repeat(20), 'one')
  await edges.write('b'.repeat(20), 'two')
  const names = await readdir(
    new URL('node_modules/.astro/website-theme/', directory),
  )
  expect(names.sort()).toEqual([
    `edges-${'b'.repeat(20)}`,
    `edges-italic-${'c'.repeat(20)}`,
  ])
})

test('the key changes with any input and is stable for the same input', () => {
  expect(digest('a', 'b')).toBe(digest('a', 'b'))
  expect(digest('a', 'b')).not.toBe(digest('a', 'c'))
  expect(digest(new Uint8Array([1, 2]))).not.toBe(
    digest(new Uint8Array([1, 3])),
  )
  expect(digest('x')).toHaveLength(20)
})

test('library versions come from the installed packages', () => {
  const [harfbuzz] = libraryVersions('harfbuzzjs')
  expect(harfbuzz).toMatch(/^harfbuzzjs@\d+\.\d+\.\d+/)
  expect(libraryVersions('@kitlangton/justice')[0]).toMatch(
    /^@kitlangton\/justice@\d+\.\d+\.\d+/,
  )
  expect(() => libraryVersions('not-an-installed-package')).toThrow()
})
