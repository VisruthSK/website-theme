import { expect, test } from "@playwright/test"
import { groupByYear } from "../../src/lib/group.ts"

const item = (name: string, iso?: string) => ({
  name,
  date: iso ? new Date(iso) : undefined,
})

test("years run newest first, keep input order, and undated comes last", () => {
  const groups = groupByYear(
    [
      item("a", "2024-03-01"),
      item("b"),
      item("c", "2025-01-01"),
      item("d", "2024-12-31"),
    ],
    (entry) => entry.date,
  )
  expect(groups.map(({ heading }) => heading)).toEqual([
    "2025",
    "2024",
    "Undated",
  ])
  expect(groups[1].entries.map(({ name }) => name)).toEqual(["a", "d"])
})

test("a comparer orders entries within each year", () => {
  const groups = groupByYear(
    [item("a", "2024-01-01"), item("b", "2024-06-01")],
    (entry) => entry.date,
    (a, b) => b.date!.valueOf() - a.date!.valueOf(),
  )
  expect(groups[0].entries.map(({ name }) => name)).toEqual(["b", "a"])
})

test("years are read in UTC", () => {
  const groups = groupByYear(
    [item("a", "2024-01-01T00:00:00Z")],
    (entry) => entry.date,
  )
  expect(groups[0].heading).toBe("2024")
})
