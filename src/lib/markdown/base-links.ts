import { defineHastPlugin } from "satteri"

const PROPERTIES: Record<string, string> = {
  a: "href",
  img: "src",
  source: "src",
  video: "src",
  audio: "src",
}

export const baseLinks = (base: string) =>
  defineHastPlugin({
    name: "base-links",
    element: {
      filter: Object.keys(PROPERTIES),
      visit(node, ctx) {
        const property = PROPERTIES[node.tagName]
        const value = node.properties[property]
        if (
          typeof value !== "string" ||
          !value.startsWith("/") ||
          value.startsWith("//") ||
          value === base ||
          value.startsWith(`${base}/`)
        )
          return
        ctx.setProperty(node, property, `${base}${value}`)
      },
    },
  })
