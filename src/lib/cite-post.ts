import { SITE } from "@/consts"

/**
 * biblatex copy-paste block for a post, so readers can cite the page from
 * their own .bib files. Keys are stable, brace-safe and derived from the
 * entry id; no `urldate` is emitted because it would churn on every build.
 */

const sanitize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")

const escapeField = (value: string) =>
  value.replaceAll("\\", "/").replace(/[{}]/g, "")

const citePostKey = (id: string) =>
  `${sanitize(SITE.familyName)}-${sanitize(id)}`

export const biblatexEntry = ({
  id,
  title,
  date,
  url,
}: {
  id: string
  title: string
  date: Date
  url: string
}) =>
  [
    `@online{${citePostKey(id)}`,
    `  author  = {${escapeField(`${SITE.familyName}, ${SITE.givenName}`)}}`,
    `  title   = {${escapeField(title)}}`,
    `  date    = {${date.toISOString().slice(0, 10)}}`,
    `  url     = {${escapeField(url)}}`,
    `}`,
  ].join("\n")
