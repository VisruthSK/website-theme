const ROOT = new URL('../', import.meta.url)
const PAGEFIND_MODULE = new URL('pagefind/pagefind.js', ROOT).href
const withRoot = (path) =>
  path.startsWith(ROOT.pathname)
    ? path
    : new URL(path.replace(/^[/]/, ''), ROOT).pathname
const DEBOUNCE = 120
const TAGS_SHOWN = 6
const WORDS_PER_MINUTE = 200
const IDLE = 'Start typing to search the archive.'
const UNAVAILABLE =
  'Search unavailable right now. Build the site locally to regenerate the search bundle.'

const $ = (selector) => document.querySelector(selector)
const input = $('[data-search-input]')
const readout = $('[data-search-status]')
const section = $('[data-search-section]')
const list = $('[data-search-results]')
const nav = $('[data-search-pagination]')
const template = $('#search-result-template')

const pageSize = Number.parseInt(section.dataset.pageSize, 10) || 10
const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const numberFormat = new Intl.NumberFormat('en-US')

const url = new URL(window.location.href)
let query = url.searchParams.get('q') ?? ''
let page = Math.max(1, Number.parseInt(url.searchParams.get('page'), 10) || 1)
let results = []
let ticket = 0
let timer = 0

const escapeHtml = (text) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  )

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const squash = (text) => text.replace(/\s+/g, ' ').trim()

const element = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const highlight = (text, terms) => {
  if (!terms.length) return escapeHtml(text)
  const pattern = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi')
  return text
    .split(pattern)
    .map((part) =>
      terms.includes(part.toLowerCase())
        ? `<mark>${escapeHtml(part)}</mark>`
        : escapeHtml(part),
    )
    .join('')
}

const parseExcerpt = (html = '') => {
  const holder = document.createElement('template')
  holder.innerHTML = html
  return {
    text: holder.content.textContent ?? '',
    marked: [...holder.content.querySelectorAll('mark')].map((mark) =>
      squash(mark.textContent ?? '').toLowerCase(),
    ),
  }
}

const termsFor = (marked) =>
  [
    ...new Set(
      [...squash(query).toLowerCase().split(' '), ...marked].filter(Boolean),
    ),
  ].sort((a, b) => b.length - a.length)

const parseTags = (value) => {
  try {
    const tags = JSON.parse(value ?? '[]')
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
        .replace(/^[\s.,:;|/-]+/, '')
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
  const sectionLabel = meta.section_label ?? 'Pages'
  const published = new Date(meta.published_at ?? '').valueOf()
  const tags = parseTags(meta.tags)
  const title = meta.title ?? data.url
  const prefixes = [
    title,
    tags.map((tag) => `#${tag}`).join(' '),
    ...tags.map((tag) => `#${tag}`),
  ]
    .map((prefix) => prefix.trim())
    .filter(Boolean)

  return {
    url: data.url,
    title,
    sectionLabel,
    tags,
    terms: termsFor(excerpt.marked),
    publishedAt:
      sectionLabel === 'Pages' || Number.isNaN(published) ? 0 : published,
    wordCount: Number.parseInt(meta.word_count, 10) || 0,
    parent: { title: meta.parent_title, url: meta.parent_url },
    snippet:
      withoutLeading(excerpt.text, prefixes) ||
      withoutLeading(meta.description ?? '', prefixes),
  }
}

const metaItems = (result) => {
  const items = []
  if (result.publishedAt > 0) {
    items.push(
      element('span', 'meta-item', dateFormat.format(result.publishedAt)),
    )
  }
  if (result.wordCount > 0) {
    const minutes = Math.max(1, Math.round(result.wordCount / WORDS_PER_MINUTE))
    items.push(
      element(
        'span',
        'meta-item',
        `${numberFormat.format(result.wordCount)} words`,
      ),
      element('span', 'meta-item', `${minutes} min read`),
    )
  }
  if (result.parent.title && result.parent.url) {
    const link = element('a', 'search-result__meta-parent', result.parent.title)
    link.href = withRoot(result.parent.url)
    const item = element('span', 'meta-item', 'Part of ')
    item.append(link)
    items.push(item)
  }
  return items.flatMap((item, index) => {
    if (!index) return [item]
    const divider = element('span', 'meta-divider')
    divider.setAttribute('aria-hidden', 'true')
    return [divider, item]
  })
}

const tagLinks = (result) =>
  result.tags.slice(0, TAGS_SHOWN).map((tag) => {
    const link = element('a', 'chip chip-interactive', `#${tag}`)
    link.href = withRoot(`/tags/${encodeURIComponent(tag)}/`)
    const normalized = squash(tag).toLowerCase()
    if (
      result.terms.some(
        (term) => normalized.includes(term) || term.includes(normalized),
      )
    ) {
      link.classList.add('chip-match')
    }
    return link
  })

const resultNode = (result) => {
  const node = template.content.firstElementChild.cloneNode(true)
  const part = (name) => node.querySelector(`[data-${name}]`)

  part('link').href = withRoot(result.url)
  part('link').setAttribute('aria-label', result.title)
  part('section').textContent = result.sectionLabel
  part('title').innerHTML = highlight(result.title, result.terms)

  const meta = metaItems(result)
  part('meta').hidden = !meta.length
  part('meta').replaceChildren(...meta)

  const tags = tagLinks(result)
  part('tags').hidden = !tags.length
  part('tags').replaceChildren(...tags)

  part('snippet').hidden = !result.snippet
  part('snippet').innerHTML = highlight(result.snippet, result.terms)
  return node
}

const pageButton = (target, label, ariaLabel, disabled = false) => {
  const button = element('button', 'pagination-link', label)
  button.type = 'button'
  button.dataset.page = String(target)
  button.setAttribute('aria-label', ariaLabel)
  if (disabled) {
    button.disabled = true
    button.classList.add('is-disabled')
  }
  if (target === page && label === String(target)) {
    button.classList.add('is-active')
    button.setAttribute('aria-current', 'page')
  }
  return button
}

const paginationList = (totalPages) => {
  const shown = [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter((number) => number >= 1 && number <= totalPages)
    .sort((a, b) => a - b)

  const items = [
    pageButton(Math.max(1, page - 1), '‹', 'Previous page', page === 1),
  ]
  shown.forEach((number, index) => {
    if (index && number - shown[index - 1] > 1) {
      items.push(element('span', 'pagination-ellipsis', '…'))
    }
    items.push(pageButton(number, String(number), `Go to page ${number}`))
  })
  items.push(
    pageButton(
      Math.min(totalPages, page + 1),
      '›',
      'Next page',
      page === totalPages,
    ),
  )

  const ul = element('ul', 'pagination-list')
  ul.append(
    ...items.map((item) => {
      const li = document.createElement('li')
      li.append(item)
      return li
    }),
  )
  return ul
}

const syncUrl = () => {
  if (query) url.searchParams.set('q', query)
  else url.searchParams.delete('q')
  if (page > 1) url.searchParams.set('page', String(page))
  else url.searchParams.delete('page')
  window.history.replaceState({}, '', url)
}

const reset = (message) => {
  results = []
  list.replaceChildren()
  section.hidden = true
  nav.hidden = true
  nav.replaceChildren()
  readout.textContent = message
}

const pagefind = import(PAGEFIND_MODULE).catch((error) => {
  console.error(error)
  readout.textContent = UNAVAILABLE
  return null
})

const show = async (current = ticket) => {
  if (!results.length) {
    return reset(query ? 'No matches found. Try different keywords.' : IDLE)
  }

  const totalPages = Math.ceil(results.length / pageSize)
  page = Math.min(Math.max(1, page), totalPages)
  syncUrl()

  const start = (page - 1) * pageSize
  let visible
  try {
    visible = await Promise.all(
      results.slice(start, start + pageSize).map(toResult),
    )
  } catch (error) {
    console.error(error)
    if (current === ticket) reset(UNAVAILABLE)
    return
  }
  if (current !== ticket) return

  section.hidden = false
  readout.textContent =
    results.length === 1
      ? 'Showing 1 match.'
      : `Showing ${start + 1}–${start + visible.length} of ${results.length} matches.`
  list.replaceChildren(...visible.map(resultNode))
  nav.hidden = totalPages <= 1
  nav.replaceChildren(...(totalPages > 1 ? [paginationList(totalPages)] : []))
}

const search = async (text, keepPage = false) => {
  const current = ++ticket
  query = text.trim()
  if (!keepPage) page = 1
  syncUrl()
  if (!query) return reset(IDLE)

  const engine = await pagefind
  if (!engine) return
  readout.textContent = 'Searching…'

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

input.addEventListener('input', () => {
  window.clearTimeout(timer)
  if (!input.value.trim()) return void search(input.value)
  timer = window.setTimeout(() => void search(input.value), DEBOUNCE)
})

$('form[role="search"]').addEventListener('submit', (event) => {
  event.preventDefault()
  window.clearTimeout(timer)
  void search(input.value)
})

nav.addEventListener('click', (event) => {
  const button = event.target.closest?.('button[data-page]')
  if (!button || button.disabled) return
  page = Math.max(1, Number.parseInt(button.dataset.page, 10) || 1)
  void show()
})

if (query.trim()) void search(query, true)
else reset(IDLE)
