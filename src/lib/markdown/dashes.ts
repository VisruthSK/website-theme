import { defineMdastPlugin } from "satteri"

export const dashes = defineMdastPlugin({
  name: "dashes",
  text(node, ctx) {
    if (node.value.includes("--")) {
      ctx.setField(node, "value", node.value.replace(/-{2,3}/g, "—"))
    }
  },
})
