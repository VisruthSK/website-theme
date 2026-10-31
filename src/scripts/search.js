const ROOT = new URL("../", import.meta.url)
const PAGEFIND_MODULE = new URL("pagefind/pagefind.js", ROOT).href
const withRoot = (path) =>
  path.startsWith(ROOT.pathname)
    ? path
    : new URL(path.replace(/^[/]/, ""), ROOT).pathname
const DEBOUNCE = 120
const TAGS_SHOWN = 6
const WORDS_PER_MINUTE = 200
const IDLE = "Start typing to search the archive."
const UNAVAILABLE =
  "Search unavailable right now. Build the site locally to regenerate the search bundle."

const $ = (selector) => document.querySelector(selector)
const input = $("[data-search-input]")
const readout = $("[data-search-status]")
const section = $("[data-search-section]")
const list = $("[data-search-results]")
const template = $("#search-result-template")

const monthFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
})
const formatDate = (time) => {
  const date = new Date(time)
  return `${date.getUTCDate()} ${monthFormat.format(date)} ${date.getUTCFullYear()}`
}
const numberFormat = new Intl.NumberFormat("en-US")

const url = new URL(window.location.href)
let query = url.searchParams.get("q") ?? ""
let results = []
let ticket = 0
let timer = 0

const escapeHtml = (text) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  )

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const squash = (text) => text.replace(/\s+/g, " ").trim()

const element = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const highlight = (text, terms) => {
  if (!terms.length) return escapeHtml(text)
  const pattern = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi")
  return text
    .split(pattern)
    .map((part) =>
      terms.includes(part.toLowerCase())
        ? `<mark>${escapeHtml(part)}</mark>`
        : escapeHtml(part),
    )
    .join("")
}

const parseExcerpt = (html = "") => {
  const holder = document.createElement("template")
  holder.innerHTML = html
  return {
    text: holder.content.textContent ?? "",
    marked: [...holder.content.querySelectorAll("mark")].map((mark) =>
      squash(mark.textContent ?? "").toLowerCase(),
    ),
  }
}

const termsFor = (marked) =>
  [
    ...new Set(
      [...squash(query).toLowerCase().split(" "), ...marked].filter(Boolean),
    ),
  ].sort((a, b) => b.length - a.length)

const parseTags = (value) => {
  try {
    const tags = JSON.parse(value ?? "[]")
    return Array.isArray(tags)
      ? tags.map((tag) => String(tag).trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

const withoutLeading = (text, prefixes) => {
  let snippet = squash(text)
  for (let changed = true; changed && snippet;) {
    changed = false
    for (const prefix of prefixes) {
      if (!snippet.toLowerCase().startsWith(prefix.toLowerCase())) continue
      snippet = snippet
        .slice(prefix.length)
        .replace(/^[\s.,:;|/-]+/, "")
        .trim()
      changed = true
    }
  }
  return snippet
}

const toResult = async (hit) => {
  const data = await hit.data()
  const meta = data.meta ?? {}
  const excerpt = parseExcerpt(data.excerpt)
  const sectionLabel = meta.section_label ?? "Pages"
  const published = new Date(meta.published_at ?? "").valueOf()
  const tags = parseTags(meta.tags)
  const title = meta.title ?? data.url
  const prefixes = [
    title,
    tags.map((tag) => `#${tag}`).join(" "),
    ...tags.map((tag) => `#${tag}`),
  ]
    .map((prefix) => prefix.trim())
    .filter(Boolean)

  const result = {
    url: data.url,
    title,
    sectionLabel,
    tags,
    terms: termsFor(excerpt.marked),
    publishedAt:
      sectionLabel === "Pages" || Number.isNaN(published) ? 0 : published,
    wordCount: Number.parseInt(meta.word_count, 10) || 0,
    parent: { title: meta.parent_title, url: meta.parent_url },
    snippet:
      withoutLeading(excerpt.text, prefixes) ||
      withoutLeading(meta.description ?? "", prefixes),
  }

  const entries =
    meta.entries === "true"
      ? data.sub_results
          .filter((sub) => sub.anchor)
          .map((sub) => {
            const subExcerpt = parseExcerpt(sub.excerpt)
            return {
              ...result,
              url: sub.url,
              title: sub.title,
              terms: termsFor(subExcerpt.marked),
              publishedAt: 0,
              wordCount: 0,
              snippet: withoutLeading(subExcerpt.text, [sub.title]),
            }
          })
      : []
  return entries.length ? entries : [result]
}

const metaItems = (result) => {
  const items = []
  if (result.publishedAt > 0) {
    items.push(element("span", "meta-item", formatDate(result.publishedAt)))
  }
  if (result.wordCount > 0) {
    const minutes = Math.max(1, Math.round(result.wordCount / WORDS_PER_MINUTE))
    items.push(
      element(
        "span",
        "meta-item",
        `${numberFormat.format(result.wordCount)} words`,
      ),
      element("span", "meta-item", `${minutes} min read`),
    )
  }
  if (result.parent.title && result.parent.url) {
    const link = element("a", "search-result__meta-parent", result.parent.title)
    link.href = withRoot(result.parent.url)
    const item = element("span", "meta-item", "Part of ")
    item.append(link)
    items.push(item)
  }
  return items.flatMap((item, index) => {
    if (!index) return [item]
    const divider = element("span", "meta-divider")
    divider.setAttribute("aria-hidden", "true")
    return [divider, item]
  })
}

const tagLinks = (result) =>
  result.tags.slice(0, TAGS_SHOWN).map((tag) => {
    const link = element("a", "chip chip-interactive", `#${tag}`)
    link.href = withRoot(`/tags/${encodeURIComponent(tag)}/`)
    const normalized = squash(tag).toLowerCase()
    if (
      result.terms.some(
        (term) => normalized.includes(term) || term.includes(normalized),
      )
    ) {
      link.classList.add("chip-match")
    }
    return link
  })

const resultNode = (result) => {
  const node = template.content.firstElementChild.cloneNode(true)
  const part = (name) => node.querySelector(`[data-${name}]`)

  part("link").href = withRoot(result.url)
  part("link").setAttribute("aria-label", result.title)
  part("section").textContent = result.sectionLabel
  part("title").innerHTML = highlight(result.title, result.terms)

  const meta = metaItems(result)
  part("meta").hidden = !meta.length
  part("meta").replaceChildren(...meta)

  const tags = tagLinks(result)
  part("tags").hidden = !tags.length
  part("tags").replaceChildren(...tags)

  part("snippet").hidden = !result.snippet
  part("snippet").innerHTML = highlight(result.snippet, result.terms)
  return node
}

const syncUrl = () => {
  if (query) url.searchParams.set("q", query)
  else url.searchParams.delete("q")
  url.searchParams.delete("page")
  window.history.replaceState({}, "", url)
}

const reset = (message) => {
  results = []
  list.replaceChildren()
  section.hidden = true
  readout.textContent = message
}

const pagefind = import(PAGEFIND_MODULE).catch((error) => {
  console.error(error)
  readout.textContent = UNAVAILABLE
  return null
})

const show = async (current = ticket) => {
  if (!results.length) {
    return reset(query ? "No matches found. Try different keywords." : IDLE)
  }

  let visible
  try {
    visible = (await Promise.all(results.map(toResult))).flat()
  } catch (error) {
    console.error(error)
    if (current === ticket) reset(UNAVAILABLE)
    return
  }
  if (current !== ticket) return

  section.hidden = false
  readout.textContent =
    visible.length === 1
      ? "Showing 1 match."
      : `Showing ${visible.length} matches.`
  list.replaceChildren(...visible.map(resultNode))
}

const search = async (text) => {
  const current = ++ticket
  query = text.trim()
  syncUrl()
  if (!query) return reset(IDLE)

  const engine = await pagefind
  if (!engine) return
  readout.textContent = "Searching…"

  try {
    const found = await engine.search(query)
    if (current !== ticket) return
    results = found?.results ?? []
  } catch (error) {
    console.error(error)
    if (current === ticket) reset(UNAVAILABLE)
    return
  }
  await show(current)
}

input.value = query
void pagefind.then((engine) => engine?.init())

input.addEventListener("input", () => {
  window.clearTimeout(timer)
  if (!input.value.trim()) return void search(input.value)
  timer = window.setTimeout(() => void search(input.value), DEBOUNCE)
})

$('form[role="search"]').addEventListener("submit", (event) => {
  event.preventDefault()
  window.clearTimeout(timer)
  void search(input.value)
})

if (query.trim()) void search(query)
else reset(IDLE)
