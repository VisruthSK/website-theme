import { FEATURES, SITE } from "@/consts"

import {
  renderLedgerInline as renderLedgerInlinePure,
  renderLedgerMarkdown,
  type LedgerMarkdownOptions,
} from "./markdown/ledger-markdown"

const options = (): LedgerMarkdownOptions => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  return { site: SITE.href, base, icons: FEATURES.externalLinkIcons }
}

/** Block Markdown for ledger text such as notes and descriptions. */
export const renderLedgerNote = (note: string) =>
  renderLedgerMarkdown(note, options())

/** Single-line Markdown for card titles, unwrapped from its outer paragraph. */
export const renderLedgerInline = (inline: string) =>
  renderLedgerInlinePure(inline, options())
