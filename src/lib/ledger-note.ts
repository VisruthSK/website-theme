import { markdownToHtml } from "satteri"

export const renderLedgerNote = (note: string) => markdownToHtml(note).html
