declare module 'bibtex-parse' {
  export interface BibTeXEntry {
    key?: string
    id?: string
    type: string
    fields: Record<string, string>
  }

  export function parse(bibtex: string): BibTeXEntry[]
}
