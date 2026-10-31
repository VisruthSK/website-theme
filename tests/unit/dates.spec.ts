import { expect, test } from "@playwright/test"
import { formatDate, formatLooseDate } from "../../src/lib/dates.ts"

test("dates print as day, month name and year", () => {
  expect(formatDate(new Date("2026-10-30T00:00:00Z"))).toBe("30 October 2026")
  expect(formatDate(new Date("2026-01-05T23:59:59Z"))).toBe("5 January 2026")
})

test("loose dates print what they hold, like a normal date", () => {
  expect(formatLooseDate(1989)).toBe("1989")
  expect(formatLooseDate("2026")).toBe("2026")
  expect(formatLooseDate("Jun 1962")).toBe("June 1962")
  expect(formatLooseDate("June 1962")).toBe("June 1962")
  expect(formatLooseDate("1908-03")).toBe("March 1908")
  expect(formatLooseDate(20040225)).toBe("25 February 2004")
  expect(formatLooseDate("2022-10-25")).toBe("25 October 2022")
  expect(formatLooseDate(new Date("2022-10-25T00:00:00Z"))).toBe(
    "25 October 2022",
  )
})

test("anything else is printed as written", () => {
  expect(formatLooseDate("c. 1850")).toBe("c. 1850")
  expect(formatLooseDate("  spring 1999  ")).toBe("spring 1999")
})
