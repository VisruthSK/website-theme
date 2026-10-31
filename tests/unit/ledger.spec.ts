import { expect, test } from '@playwright/test'
import {
  dateRange,
  ledgerGroups,
  ledgerPermalinks,
  slugify,
  type LedgerEntry,
} from '../../src/lib/ledger.ts'

const entry = (id: string, title: string, ended?: string): LedgerEntry => ({
  id,
  data: {
    title,
    creator: 'Someone',
    favorite: false,
    ended: ended ? new Date(ended) : undefined,
  },
})

const day = (iso: string) => new Date(iso)

test('titles become plain slugs', () => {
  expect(slugify('The Remains of the Day')).toBe('the-remains-of-the-day')
  expect(slugify('Sanshirō: A Novel!')).toBe('sanshiro-a-novel')
})

test('years run newest first, entries newest first, undated last', () => {
  const groups = ledgerGroups([
    entry('a', 'A', '2025-05-31'),
    entry('b', 'B', '2026-06-21'),
    entry('c', 'C'),
    entry('d', 'D', '2026-10-19'),
    entry('e', 'E', '2026-10-19'),
  ])
  expect(
    groups.map(({ heading, entries }) => [
      heading,
      entries.map(({ id }) => id),
    ]),
  ).toEqual([
    ['2026', ['d', 'e', 'b']],
    ['2025', ['a']],
    ['Undated', ['c']],
  ])
})

test('there is no Undated group when every entry has an end date', () => {
  const groups = ledgerGroups([entry('a', 'A', '2025-05-31')])
  expect(groups.map(({ heading }) => heading)).toEqual(['2025'])
})

test('rereads count up in the order they were finished', () => {
  const permalinks = ledgerPermalinks([
    entry('later', 'Pale Fire', '2026-09-03'),
    entry('other', 'Bel Canto', '2025-05-31'),
    entry('earlier', 'Pale Fire', '2025-11-02'),
    entry('undated', 'Pale Fire'),
  ])
  expect(permalinks.get('earlier')).toBe('pale-fire-01')
  expect(permalinks.get('later')).toBe('pale-fire-02')
  expect(permalinks.get('undated')).toBe('pale-fire-03')
  expect(permalinks.get('other')).toBe('bel-canto-01')
})

test('a reading shows one date, a range, or an open range', () => {
  expect(dateRange(undefined, day('2025-05-31'))).toEqual({
    dates: [day('2025-05-31')],
    open: false,
  })
  expect(dateRange(day('2025-05-31'), day('2025-05-31'))).toEqual({
    dates: [day('2025-05-31')],
    open: false,
  })
  expect(dateRange(day('2026-10-06'), day('2026-10-19'))).toEqual({
    dates: [day('2026-10-06'), day('2026-10-19')],
    open: false,
  })
  expect(dateRange(day('2026-10-06'), undefined)).toEqual({
    dates: [day('2026-10-06')],
    open: true,
  })
  expect(dateRange()).toEqual({ dates: [], open: false })
})

test('DNF entries use the finish date, then the start date, then Undated', () => {
  const dnf = (id: string, started?: string, ended?: string): LedgerEntry => ({
    id,
    data: {
      title: id,
      creator: 'Someone',
      favorite: false,
      rating: 'DNF',
      started: started ? day(started) : undefined,
      ended: ended ? day(ended) : undefined,
    },
  })
  const groups = ledgerGroups([
    dnf('start-only', '2025-01-01'),
    dnf('finished', '2024-01-01', '2026-01-01'),
    dnf('undated'),
    {
      ...entry('in-progress', 'In progress'),
      data: {
        ...entry('in-progress', 'In progress').data,
        started: day('2026-01-01'),
      },
    },
  ])
  expect(
    groups.map(({ heading, entries }) => [
      heading,
      entries.map(({ id }) => id),
    ]),
  ).toEqual([
    ['2026', ['finished']],
    ['2025', ['start-only']],
    ['Undated', ['undated', 'in-progress']],
  ])
})
