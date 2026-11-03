import { fromHtml } from "hast-util-from-html"
import { selectAll } from "hast-util-select"
import { documentUri, parseFeed, publicationParts } from "./standard-site.mjs"

const {
  STANDARD_SITE_URL: site,
  STANDARD_SITE_PUBLICATION: publication,
  ATPROTO_IDENTIFIER: identifier,
  ATPROTO_PASSWORD: password,
} = process.env
if (!site || !publication || !identifier || !password)
  throw new Error(
    "Set STANDARD_SITE_URL, STANDARD_SITE_PUBLICATION, ATPROTO_IDENTIFIER and ATPROTO_PASSWORD",
  )
const { did, rkey } = publicationParts(publication)
const fetchText = async (url) => {
  const response = await fetch(url, { redirect: "error" })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}
const base = new URL(site)
const verification = new URL(
  `/.well-known/site.standard.publication${base.pathname.replace(/\/$/, "")}`,
  base,
)
if ((await fetchText(verification)).trim() !== publication)
  throw new Error("Publication verification does not match")
const feed = await fetchText(
  new URL("rss.xml", site.endsWith("/") ? site : `${site}/`),
)
const { publication: publicationRecord, records } = parseFeed(
  feed,
  site,
  publication,
)
for (const { url, key } of records) {
  const html = fromHtml(await fetchText(url))
  const links = selectAll("head link[rel='site.standard.document']", html)
  if (
    !links.some(
      (link) => link.properties.href === documentUri(publication, key),
    )
  )
    throw new Error(`Document verification does not match: ${url}`)
}
const webParts = did.startsWith("did:web:")
  ? did.slice(8).split(":").map(decodeURIComponent)
  : []
const didUrl = did.startsWith("did:plc:")
  ? `https://plc.directory/${did}`
  : `https://${webParts[0]}${webParts.length === 1 ? "/.well-known" : `/${webParts.slice(1).join("/")}`}/did.json`
const doc = JSON.parse(await fetchText(didUrl))
if (doc.id !== did) throw new Error("DID document does not match")
const service = doc.service?.find(
  (entry) =>
    entry.id === "#atproto_pds" && entry.type === "AtprotoPersonalDataServer",
)
const pds = new URL(service?.serviceEndpoint)
if (pds.protocol !== "https:" || pds.pathname !== "/" || pds.search || pds.hash)
  throw new Error("Invalid PDS URL")
async function xrpc(method, { body, token, query } = {}) {
  const url = new URL(`/xrpc/${method}`, pds)
  if (query) url.search = new URLSearchParams(query).toString()
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    redirect: "error",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`)
  return response.json()
}
const session = await xrpc("com.atproto.server.createSession", {
  body: { identifier, password },
})
if (session.did !== did)
  throw new Error("Authenticated account does not own the publication")
const token = session.accessJwt
async function list(collection) {
  const records = new Map()
  let cursor
  do {
    const page = await xrpc("com.atproto.repo.listRecords", {
      token,
      query: {
        repo: did,
        collection,
        limit: "100",
        ...(cursor ? { cursor } : {}),
      },
    })
    for (const record of page.records)
      records.set(record.uri.split("/").pop(), record)
    cursor = page.cursor
  } while (cursor)
  return records
}
const publications = await list("site.standard.publication")
const documents = await list("site.standard.document")
const existingPublication = publications.get(rkey)
if (!existingPublication)
  publicationRecord.preferences = { showInDiscover: true }
if (
  existingPublication &&
  existingPublication.value.url.replace(/\/$/, "") !== publicationRecord.url
)
  throw new Error("Publication key belongs to another site")
for (const { key, record } of records) {
  const existing = documents.get(key)
  if (
    existing &&
    (existing.value.site !== publication || existing.value.path !== record.path)
  )
    throw new Error(`Document key collision: ${key}`)
}
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  )
async function put(collection, key, value, existing) {
  const next = existing ? { ...existing.value, ...value } : value
  if (collection === "site.standard.document") {
    for (const field of ["description", "tags"])
      if (!(field in value)) delete next[field]
  }
  if (existing && canonical(existing.value) === canonical(next)) return
  await xrpc("com.atproto.repo.putRecord", {
    token,
    body: {
      repo: did,
      collection,
      rkey: key,
      record: next,
      swapRecord: existing?.cid ?? null,
    },
  })
  console.log(`${existing ? "Updated" : "Created"} ${collection}/${key}`)
}
await put(
  "site.standard.publication",
  rkey,
  publicationRecord,
  existingPublication,
)
for (const { key, record } of records)
  await put("site.standard.document", key, record, documents.get(key))
