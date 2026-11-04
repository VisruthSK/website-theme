import { createHash } from "node:crypto"
import { XMLParser } from "fast-xml-parser"
import { SyntaxValidator } from "fast-xml-validator"
import { fromHtml } from "hast-util-from-html"
import { toText } from "hast-util-to-text"

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false,
})
const array = (value) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]

export function publicationParts(uri) {
  const match =
    /^at:\/\/(did:(?:plc:[a-z2-7]+|web:[a-zA-Z0-9.%:-]+))\/site\.standard\.publication\/([234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12})$/.exec(
      uri,
    )
  if (!match) throw new Error("Invalid Standard.site publication AT-URI")
  return { did: match[1], rkey: match[2] }
}

export function documentKey(url) {
  const hash = createHash("sha256").update(url).digest()
  const micros =
    1577836800000000n + (hash.readBigUInt64BE(0) % 315576000000000n)
  let value = (micros << 10n) | BigInt(hash.readUInt16BE(4) & 1023)
  const alphabet = "234567abcdefghijklmnopqrstuvwxyz"
  let result = ""
  for (let i = 0; i < 13; i++) {
    result = alphabet[Number(value & 31n)] + result
    value >>= 5n
  }
  return result
}

export function parseFeed(xml, site, publication) {
  if (SyntaxValidator.validate(xml) !== true) throw new Error("Invalid RSS XML")
  const channel = parser.parse(xml)?.rss?.channel
  if (!channel || !channel.title || !channel.description)
    throw new Error("Invalid RSS channel")
  const base = new URL(site)
  if (base.protocol !== "https:" || base.search || base.hash)
    throw new Error("Site URL must be HTTPS without a query or fragment")
  const prefix = base.pathname.replace(/\/$/, "")
  const seen = new Set()
  const records = array(channel.item).map((item) => {
    const url = new URL(item.link)
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(`${prefix}/`) ||
      url.search ||
      url.hash
    )
      throw new Error(`RSS link outside publication: ${url}`)
    if (!item.title || !item.pubDate || !item["content:encoded"])
      throw new Error(`Incomplete RSS item: ${url}`)
    const publishedAt = new Date(item.pubDate).toISOString()
    const path = url.pathname.slice(prefix.length)
    const key = documentKey(url.href)
    if (seen.has(key)) throw new Error(`Duplicate document key: ${key}`)
    seen.add(key)
    const content = String(item["content:encoded"])
    const record = {
      $type: "site.standard.document",
      site: publication,
      path,
      title: String(item.title),
      publishedAt,
      content: { $type: "org.wordpress.html", html: content },
      textContent: toText(fromHtml(content, { fragment: true })),
    }
    if (item.description) record.description = String(item.description)
    const tags = array(item.category).map(String)
    if (tags.length) record.tags = tags
    return { key, url: url.href, record }
  })
  return {
    publication: {
      $type: "site.standard.publication",
      url: site.replace(/\/$/, ""),
      name: String(channel.title),
      description: String(channel.description),
    },
    records,
  }
}

export function documentUri(publication, key) {
  return `at://${publicationParts(publication).did}/site.standard.document/${key}`
}
