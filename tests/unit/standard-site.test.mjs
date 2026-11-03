import assert from "node:assert/strict"
import { test } from "node:test"
import { documentUri, parseFeed } from "../../scripts/standard-site.mjs"

const site = "https://example.com/"
const publication =
  "at://did:plc:abc234/site.standard.publication/2222222222222"
const feed = (title = "First") =>
  `<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Site</title><description>Example</description><item><title>${title}</title><link>https://example.com/blog/first/</link><pubDate>Wed, 01 Jan 2025 00:00:00 GMT</pubDate><description>Summary</description><category>test</category><content:encoded><![CDATA[<p>Hello <strong>world</strong>.</p>]]></content:encoded></item></channel></rss>`

test("sync creates, skips unchanged, updates in place and rejects unverified pages", async () => {
  const original = globalThis.fetch
  const env = { ...process.env }
  Object.assign(process.env, {
    STANDARD_SITE_URL: site,
    STANDARD_SITE_PUBLICATION: publication,
    ATPROTO_IDENTIFIER: "example.com",
    ATPROTO_PASSWORD: "app-password",
  })
  let xml = feed(),
    verified = true,
    writes = 0
  const stored = new Map()
  const record = () => parseFeed(xml, site, publication).records[0]
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input)
    const json = (value) => new Response(JSON.stringify(value), { status: 200 })
    if (url.hostname === "example.com") {
      if (url.pathname.startsWith("/.well-known/"))
        return new Response(publication)
      if (url.pathname === "/rss.xml") return new Response(xml)
      return new Response(
        `<head>${verified ? `<link rel="site.standard.document" href="${documentUri(publication, record().key)}">` : ""}</head>`,
      )
    }
    if (url.hostname === "plc.directory")
      return json({
        id: "did:plc:abc234",
        service: [
          {
            id: "#atproto_pds",
            type: "AtprotoPersonalDataServer",
            serviceEndpoint: "https://pds.example",
          },
        ],
      })
    const method = url.pathname.split("/").pop()
    if (method === "com.atproto.server.createSession")
      return json({ did: "did:plc:abc234", accessJwt: "token" })
    if (method === "com.atproto.repo.listRecords")
      return json({
        records: [...stored.values()].filter((entry) =>
          entry.uri.includes(`/${url.searchParams.get("collection")}/`),
        ),
      })
    if (method === "com.atproto.repo.putRecord") {
      const body = JSON.parse(options.body)
      const uri = `at://${body.repo}/${body.collection}/${body.rkey}`
      stored.set(uri, { uri, cid: `cid${++writes}`, value: body.record })
      return json({ uri, cid: `cid${writes}` })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  try {
    await import(`../../scripts/sync-standard-site.mjs?first`)
    assert.equal(writes, 2)
    const key = record().key
    await import(`../../scripts/sync-standard-site.mjs?repeat`)
    assert.equal(writes, 2)
    xml = feed("Edited")
    assert.equal(record().key, key)
    await import(`../../scripts/sync-standard-site.mjs?edit`)
    assert.equal(writes, 3)
    verified = false
    await assert.rejects(
      import(`../../scripts/sync-standard-site.mjs?failure`),
      /verification does not match/,
    )
    assert.equal(writes, 3)
    assert.equal(record().record.textContent, "Hello world.")
    assert.throws(
      () =>
        parseFeed(
          feed().replace(
            "https://example.com/blog/first/",
            "https://other.example/",
          ),
          site,
          publication,
        ),
      /outside publication/,
    )
  } finally {
    globalThis.fetch = original
    process.env = env
  }
})
