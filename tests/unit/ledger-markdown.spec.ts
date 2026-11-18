import { expect, test } from "@playwright/test"
import {
  ledgerPlainText,
  renderLedgerInline,
  renderLedgerMarkdown,
} from "../../src/lib/markdown/ledger-markdown.ts"

const options = { site: "https://example.com/" }
const withIcons = { ...options, icons: true }

test("renders Markdown emphasis, strong and code", () => {
  expect(
    renderLedgerMarkdown("A *book* and **another** and `code`.", options),
  ).toBe(
    "<p>A <em>book</em> and <strong>another</strong> and <code>code</code>.</p>\n",
  )
})

test("renders a folded multi-line description link with the external-link affair", () => {
  const html = renderLedgerMarkdown(
    "R interface to a [Trustdown database](https://github.com/mitchellh/vouch/?tab=readme-ov-file#vouched-file-format)",
    options,
  )
  expect(html).toContain(
    '<a href="https://github.com/mitchellh/vouch/?tab=readme-ov-file#vouched-file-format" target="_blank" rel="noopener noreferrer" aria-describedby="external-link-new-tab-description" data-external="">Trustdown database</a>',
  )
})

test("external links open in a new tab with noopener", () => {
  const html = renderLedgerMarkdown(
    "[out](https://elsewhere.example/) and [home](/here/) and [same](https://example.com/a)",
    options,
  )
  expect(html).toMatch(
    /<a href="https:\/\/elsewhere\.example\/" target="_blank" rel="noopener noreferrer" aria-describedby="[^"]+" data-external="">out<\/a>/,
  )
  for (const href of ["/here/", "https://example.com/a"]) {
    expect(html).toContain(`<a href="${href}">`)
  }
  expect(html).not.toMatch(
    new RegExp(
      `href="${"https://example.com/a".replaceAll("/", "\\/")}" target`,
    ),
  )
})

test("external links carry the new-tab icon when icons are on", () => {
  expect(
    renderLedgerMarkdown("[out](https://elsewhere.example/)", withIcons),
  ).toContain("external-link-icon-wrap")
})

test("root-relative links gain the base path on sub-path deployments", () => {
  const html = renderLedgerMarkdown("[home](/essays/)", {
    ...options,
    base: "/site",
  })
  expect(html).toContain('href="/site/essays/"')
})

test("inline Markdown unwraps a single outer paragraph", () => {
  expect(renderLedgerInline("`foil` and *foil*", options)).toBe(
    "<code>foil</code> and <em>foil</em>",
  )
})

test("inline Markdown leaves links inline, with the external-link affair", () => {
  expect(
    renderLedgerInline(
      "[`_brand.yml`](https://posit-dev.github.io/brand-yml/)",
      options,
    ),
  ).toBe(
    '<a href="https://posit-dev.github.io/brand-yml/" target="_blank" rel="noopener noreferrer" aria-describedby="external-link-new-tab-description" data-external=""><code>_brand.yml</code></a>',
  )
})

test("plain text strips links, emphasis and code markers", () => {
  expect(
    ledgerPlainText(
      "A [`foil`](https://example.com/) and **bold** and *gone*.",
    ),
  ).toBe("A foil and bold and gone.")
})
