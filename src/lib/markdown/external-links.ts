import { defineHastPlugin } from "satteri"
import {
  EXTERNAL_LINK_ICON_HTML,
  externalTo,
  NEW_TAB_DESCRIPTION_ID,
} from "../external-link-utils"

export function externalLinks(site: string, icons: boolean) {
  const isExternal = externalTo(site)
  const indicator = { type: "raw" as const, value: EXTERNAL_LINK_ICON_HTML }
  return defineHastPlugin({
    name: "external-links",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        if (!isExternal(node.properties.href)) return
        ctx.setProperty(node, "target", "_blank")
        ctx.setProperty(node, "rel", ["noopener", "noreferrer"])
        ctx.setProperty(node, "ariaDescribedBy", NEW_TAB_DESCRIPTION_ID)
        ctx.setProperty(node, "dataExternal", "")
        if (icons) ctx.appendChild(node, indicator)
      },
    },
  })
}
