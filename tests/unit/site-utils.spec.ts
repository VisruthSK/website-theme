import { expect, test } from "@playwright/test"
import { calculateWordCount } from "../../src/lib/word-count.ts"

test("counts words in prose", () => {
  expect(calculateWordCount("one two three")).toBe(3)
  expect(calculateWordCount("<p>one</p> two")).toBe(2)
  expect(calculateWordCount("")).toBe(0)
})

test("fenced code blocks are not prose", () => {
  const body = [
    "Hello world.",
    "",
    "```js",
    "const answer = 42",
    "```",
    "",
    "More words here.",
  ].join("\n")
  expect(calculateWordCount(body)).toBe(5)
  expect(
    calculateWordCount(
      ["one", "~~~", "two three four", "~~~", "five"].join("\n"),
    ),
  ).toBe(2)
})

test("inline code is not prose either", () => {
  expect(calculateWordCount("use `npm run build` often")).toBe(2)
  expect(calculateWordCount("a `x` b")).toBe(2)
})

test("null and undefined word counts are zero", () => {
  expect(calculateWordCount(null)).toBe(0)
  expect(calculateWordCount(undefined)).toBe(0)
})
