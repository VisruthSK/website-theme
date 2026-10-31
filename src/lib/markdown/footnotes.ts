import type { Element, ElementContent, Root, RootContent } from "hast"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import { defineHastPlugin } from "satteri"

const BACKREF_ICON = `<svg class="footnote-backref-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 4v7a4 4 0 0 1-4 4H4"></path><polyline points="9 10 4 15 9 20"></polyline></svg>`

type Node = RootContent | Root

const isElement = (node: Node): node is Element => node.type === "element"

const normalize = (value: string) => value.replace(/\s+/g, " ").trim()

function classNames(element: Element): string[] {
  const value = element.properties.className
  return Array.isArray(value) ? value.map(String) : []
}

const raw = (value: string) =>
  ({ type: "raw", value }) as unknown as ElementContent

function anchor(
  source: Element,
  className: string,
  extra: Element["properties"],
  children: ElementContent[],
): Element {
  const { title: _title, ...properties } = source.properties
  return {
    type: "element",
    tagName: "a",
    properties: {
      ...properties,
      ...extra,
      className: [...new Set([...classNames(source), className])],
    },
    children,
  }
}

function isBackref(element: Element): boolean {
  return (
    "dataFootnoteBackref" in element.properties ||
    classNames(element).some((name) =>
      ["footnote-backref", "data-footnote-backref"].includes(name),
    )
  )
}

function textWithoutBackrefs(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (!isElement(node) || isBackref(node)) return ""
  return node.children.map(textWithoutBackrefs).join("")
}

function plain(node: ElementContent): ElementContent | null {
  if (node.type === "text") return { type: "text", value: node.value }
  if (node.type === "raw") return { type: "raw", value: node.value } as never
  if (!isElement(node) || isBackref(node)) return null
  return {
    type: "element",
    tagName: node.tagName,
    properties: { ...node.properties },
    children: node.children.flatMap((child) => plain(child) ?? []),
  }
}

function inlineHtml(item: Element): string {
  const paragraphs = item.children.filter(
    (child): child is Element => isElement(child) && child.tagName === "p",
  )
  return paragraphs
    .map((paragraph) =>
      toHtml(
        {
          type: "root",
          children: paragraph.children.flatMap((c) => plain(c) ?? []),
        },
        { allowDangerousHtml: true },
      ).trim(),
    )
    .filter(Boolean)
    .join("<br>")
}

type Collected = { notes: Map<string, string> }

function collect(node: Node, found: Collected) {
  if (node.type === "root") {
    for (const child of node.children) collect(child, found)
    return
  }
  if (!isElement(node)) return

  const id = node.properties.id
  if (node.tagName === "li" && typeof id === "string") {
    const text = normalize(node.children.map(textWithoutBackrefs).join(""))
    if (text) found.notes.set(id, inlineHtml(node))
    return
  }

  for (const child of node.children) collect(child, found)
}

function targetId(href: unknown): string {
  if (typeof href !== "string" || !href.startsWith("#")) return ""
  try {
    return decodeURIComponent(href.slice(1))
  } catch {
    return href.slice(1)
  }
}

export const footnotes = (marginNotes: boolean) => () => {
  const found: Collected = { notes: new Map() }

  return defineHastPlugin({
    name: "footnotes",
    before(root) {
      for (const child of root.children) {
        if (isElement(child) && "dataFootnotes" in child.properties) {
          collect(child, found)
        }
      }
    },
    element: [
      {
        filter: ["section"],
        visit(node, ctx) {
          if (!("dataFootnotes" in node.properties)) return
          const heading = node.children.find(
            (child) => isElement(child) && /^h[1-6]$/.test(child.tagName),
          )
          if (!heading) return
          ctx.replaceNode(
            heading,
            h("h2", { id: "footnotes" }, [
              "Footnotes",
              h("a", {
                dataHeadingAnchor: "",
                href: "#footnotes",
                ariaLabel: "Link to this section",
                tabIndex: -1,
              }),
            ]),
          )
        },
      },
      {
        filter: ["a"],
        visit(node, ctx) {
          if (isBackref(node)) {
            const label =
              typeof node.properties.ariaLabel === "string"
                ? node.properties.ariaLabel
                : "Back to reference"
            ctx.replaceNode(
              node,
              anchor(node, "footnote-backref", {}, [
                h("span", { className: ["sr-only"] }, label),
                raw(BACKREF_ICON),
              ]),
            )
            return
          }

          if (!("dataFootnoteRef" in node.properties)) return
          const label = normalize(ctx.textContent(node))
          const note = found.notes.get(targetId(node.properties.href))

          ctx.replaceNode(
            node,
            anchor(
              node,
              "footnote-ref",
              { ariaDescribedBy: ["footnotes"] },
              node.children as ElementContent[],
            ),
          )

          if (marginNotes && note) {
            ctx.insertAfter(ctx.parent(node), {
              type: "raw",
              value: `<side-note role="note" aria-label="Footnote ${label}" data-pagefind-ignore><a href="#${node.properties.id}" aria-label="Back to reference ${label}">${label}</a> ${note}</side-note>`,
            })
          }
        },
      },
    ],
  })
}
