import { markdownToHtml } from "satteri"

import { baseLinks } from "./base-links"
import { externalLinks } from "./external-links"

export interface LedgerMarkdownOptions {
  /** Canonical origin and base path of the site, e.g. https://example.com/site/ */
  site: string
  /** Base path on sub-path deployments, e.g. "/site". Omit or "" on root deployments. */
  base?: string
  /** Append the new-tab icon to external links, as post content does. */
  icons?: boolean
}

const hastPluginsFor = ({
  site,
  base = "",
  icons = false,
}: LedgerMarkdownOptions) => [
  externalLinks(site, icons),
  ...(base ? [baseLinks(base)] : []),
]

/**
 * Renders the Markdown a ledger entry carries. Notes, descriptions and other
 * shelf text go through the same pipeline as post content, including the
 * external-link treatment: links leaving the site open in a new tab with
 * `noopener noreferrer`, and root-relative links gain the deploy base path.
 */
export const renderLedgerMarkdown = (
  source: string,
  options: LedgerMarkdownOptions,
) => markdownToHtml(source, { hastPlugins: hastPluginsFor(options) }).html

/**
 * Inline Markdown for single-line fields such as card titles. Unwraps the
 * outer paragraph the block renderer adds, so the result can sit inside a
 * heading. Multi-paragraph input keeps the paragraphs and must not be used
 * inside a heading.
 */
export const renderLedgerInline = (
  source: string,
  options: LedgerMarkdownOptions,
) => {
  const html = renderLedgerMarkdown(source, options).trim()
  const match = /^<p>([\s\S]*)<\/p>$/.exec(html)
  return match && !match[1].includes("<p") ? match[1] : html
}

/** Plain text for feed summaries: strips links, emphasis and code markers. */
export const ledgerPlainText = (markdown: string) =>
  markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`_*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
