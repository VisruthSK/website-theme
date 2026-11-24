import { getBlogs } from "@/lib/blogroll"

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")

export async function GET() {
  const outlines = (await getBlogs())
    .filter(({ data }) => data.url && data.feed)
    .map(
      ({ data: blog }) =>
        `    <outline text="${escape(blog.title)}" title="${escape(blog.title)}" type="rss" htmlUrl="${escape(blog.url!)}" xmlUrl="${escape(blog.feed!)}" />`,
    )
  return new Response(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="2.0">',
      "  <head><title>Blogroll</title></head>",
      "  <body>",
      ...outlines,
      "  </body>",
      "</opml>",
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/x-opml; charset=utf-8" } },
  )
}
