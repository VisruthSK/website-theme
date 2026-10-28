import {
  CAP_CLEARANCE,
  CAP_LINES,
  CAP_SCALE,
  EDGES,
  INDENT,
  PLAN_SIZE,
  ROOT_RATIO,
  SHRINK,
  SPACE,
  STRETCH,
  TRACKING,
} from '@/generated/typeset-constants.js'

const STEPS = 5
const STEP = 0.01
const EPSILON = 0.0005
const TOLERANCE = 0.5
const CAP_TOLERANCE = 3

const decode = (data) => {
  const [head, ...rest] = data.split(';')
  const [words, indent, cap] = head.split('.')

  let from = 0
  const bands = rest.map((part) => {
    const [delta, counts] = part.split(/[!~]/)
    from += parseInt(delta, 36)
    if (!counts) return { from }
    let end = 0
    const breaks = [...counts].map((count) => (end += parseInt(count, 36)))
    return { from, breaks }
  })
  return {
    words: parseInt(words, 36),
    indent: indent === '1' ? INDENT : 0,
    cap: parseInt(cap, 36) / CAP_SCALE,
    bands,
  }
}

const WHITESPACE = ' \n\t\r\f'

const rectOf = (node) => {
  const range = document.createRange()
  range.selectNodeContents(node)
  return range.getBoundingClientRect()
}

const inkedOf = (nodes) => nodes.filter((node) => node.data.trim())

const textNodes = (paragraph) => {
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      !node.data || node.parentElement.closest('side-note, svg')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  const nodes = []
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    nodes.push(node)
  return nodes
}

const edgeOf = (node, char) => {
  const element = node.parentElement
  if (element.closest('code')) return undefined
  const face = element.closest('em, i')
    ? 'italic'
    : element.closest('strong, b')
      ? 'bold'
      : 'roman'
  return EDGES[face][char] ?? EDGES.roman[char]
}

const gapsOf = (paragraph) => {
  const gaps = []
  const words = []
  let inWord = false
  let pending = null
  for (const node of textNodes(paragraph)) {
    for (let index = 0; index < node.data.length; index += 1) {
      const char = node.data[index]
      if (WHITESPACE.includes(char)) {
        if (inWord) pending = [node, index]
        inWord = false
        continue
      }
      if (!inWord) {
        if (pending) gaps.push(pending)
        pending = null
        words.push('')
        inWord = true
      }
      words[words.length - 1] += char
    }
  }
  return { gaps, words }
}

const wrapGap = ([node, offset]) => {
  const range = document.createRange()
  range.setStart(node, offset)
  range.setEnd(node, offset + 1)
  const marker = document.createElement('span')
  marker.className = 'jb'
  range.surroundContents(marker)
}

const offsetOf = ({ indent }, cap, line) =>
  cap ? (line < CAP_LINES ? cap : 0) : line ? 0 : indent

const linesOf = (paragraph) => {
  const lines = [[]]
  for (const node of textNodes(paragraph)) {
    if (node.parentElement.classList.contains('jb')) lines.push([])
    else if (!node.parentElement.closest('.drop-cap')) lines.at(-1).push(node)
  }
  return lines
}

const naturalWidths = ({ lines, markers, size }) =>
  lines.map((nodes, line) => {
    const inked = inkedOf(nodes)
    const right = markers[line]
      ? markers[line].getBoundingClientRect().left
      : rectOf(inked.at(-1)).right
    return (right - rectOf(inked[0]).left) / size
  })

const arrange = (state, naturals) => {
  const { band, size, words, plan, cap } = state
  const { breaks } = band
  const width = state.width / size
  const total = breaks.length + 1
  const tracks = []
  const margins = []
  let base = 0
  let last = 0
  for (let line = 0; line < total; line += 1) {
    const from = line ? breaks[line - 1] : 0
    const to = line < breaks.length ? breaks[line] : plan.words
    const inked = inkedOf(state.lines[line])
    const end = edgeOf(inked.at(-1), words[to - 1].at(-1))
    const hang = end?.[2] ?? 0
    const open = edgeOf(inked[0], words[from][0])?.[1] ?? 0
    const clearance = cap && line < CAP_LINES ? CAP_CLEARANCE : 0
    const measure = width - offsetOf(plan, cap, line) - clearance + hang + open
    margins.push({ hang, open, advance: end?.[0] })
    const gaps = to - from - 1
    let chars = gaps
    for (let word = from; word < to; word += 1) chars += words[word].length
    const natural = naturals[line]
    const final = line === total - 1
    const slack = final && natural <= measure ? 0 : measure - natural
    const capacity =
      gaps * SPACE * (slack >= 0 ? STRETCH : SHRINK) + chars * TRACKING
    const track = capacity
      ? Math.sign(slack) * Math.min(1, Math.abs(slack) / capacity) * TRACKING
      : 0
    tracks.push(track)
    const squeeze = gaps
      ? Math.min(
          Math.max(0, (natural + track * chars - measure) / gaps),
          SPACE * SHRINK,
        )
      : 0
    if (final) last = squeeze
    else base = Math.max(base, squeeze)
  }
  return { tracks, margins, base, last }
}

const spacing = (amount) => (amount > 0 ? `-${amount}em` : '0')

const tune = ({ paragraph, base, last, tails }, extra) => {
  paragraph.style.wordSpacing = base + extra > 0 ? `-${base + extra}em` : ''
  for (const tail of tails) tail.style.wordSpacing = spacing(last + extra)
}

const hangLast = (node, hang, advance) => {
  const at = node.data.trimEnd().length - 1
  const glyph = node.splitText(at)
  const after = glyph.data.length > 1 ? glyph.splitText(1) : null
  const box = document.createElement('span')
  box.className = 'jh'
  box.style.width = `${advance - hang}em`
  glyph.replaceWith(box)
  box.append(glyph)
  return after ? [box, after] : [box]
}

const dress = (state, tracks, margins) => {
  const { lines, base, last } = state
  const needTail = Math.abs(last - base) > EPSILON

  lines.forEach((nodes, index) => {
    const inked = inkedOf(nodes)
    const first = inked[0]
    const final = inked.at(-1)
    const { hang, open, advance } = margins[index]
    const track = tracks[index]
    const tail = needTail && index === tracks.length - 1
    for (const node of nodes) {
      const leading = node === first && open > EPSILON
      const trailing = node === final && hang > EPSILON
      const tracked = Math.abs(track) >= EPSILON
      if (!tracked && !tail && !leading && !trailing) continue
      const extras = trailing ? hangLast(node, hang, advance) : []
      if (!tracked && !tail && !leading) continue
      const span = document.createElement('span')
      span.className = 'jl'
      if (tracked) span.style.letterSpacing = `${track}em`
      if (leading) span.style.marginLeft = `-${open}em`
      node.replaceWith(span)
      span.append(node, ...extras)
      if (tail) state.tails.push(span)
    }
  })
}

const release = (state) => {
  const { paragraph } = state
  if (paragraph.classList.contains('j')) {
    for (const part of paragraph.querySelectorAll('.jh, .jl, .jb'))
      part.replaceWith(...part.childNodes)
    paragraph.normalize()
    paragraph.classList.remove('j')
    paragraph.style.textAlign = ''
    paragraph.style.wordSpacing = ''
  }
  state.band = null
  state.tails = []
}

const capOffset = (paragraph, left) => {
  const node = textNodes(paragraph).find(
    (text) => !text.parentElement.closest('.drop-cap') && text.data.trim(),
  )
  return rectOf(node).left - left
}

const measure = ({ paragraph, plan, band }, root) => {
  const style = getComputedStyle(paragraph)
  const size = parseFloat(style.fontSize)
  const box = paragraph.getBoundingClientRect()
  const width =
    box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  let usable =
    width > 0 &&
    (style.textAlign === 'justify' || style.textAlign === 'justify-all') &&
    Math.abs(size / root - ROOT_RATIO) < 0.01 &&
    Math.abs(parseFloat(style.textIndent) / size - plan.indent) < 0.02 &&
    !parseFloat(style.letterSpacing) &&
    (band || !parseFloat(style.wordSpacing))
  const cap = plan.cap
    ? capOffset(paragraph, box.left + parseFloat(style.paddingLeft)) / size
    : 0
  usable &&= !plan.cap || Math.abs(cap - plan.cap) < CAP_TOLERANCE
  return { size, width, usable, cap, lineHeight: parseFloat(style.lineHeight) }
}

const stage = (state, { size, width, usable, cap, lineHeight }) => {
  const { paragraph, plan } = state
  const band = usable
    ? plan.bands.findLast(
        (candidate) => candidate.from <= (width / size) * PLAN_SIZE,
      )
    : null
  if (!band?.breaks?.length) return release(state)
  if (state.band === band && state.width === width) return false

  release(state)
  const { gaps, words } = gapsOf(paragraph)
  if (words.length !== plan.words) return false

  paragraph.classList.add('j')
  for (const at of [...band.breaks].reverse()) wrapGap(gaps[at - 1])
  Object.assign(state, {
    lines: linesOf(paragraph),
    markers: [...paragraph.querySelectorAll('.jb')],
    band,
    width,
    size,
    cap,
    words,
    lineHeight,
  })
  return true
}

const commit = (state, naturals) => {
  state.paragraph.style.textAlign = ''
  const { tracks, margins, base, last } = arrange(state, naturals)
  Object.assign(state, { base, last })
  dress(state, tracks, margins)
  tune(state, 0)
}

const misfit = ({ paragraph, markers, lines, lineHeight }) => {
  const style = getComputedStyle(paragraph)
  const box = paragraph.getBoundingClientRect()
  const edge = box.right - parseFloat(style.paddingRight)
  const rects = markers.map((marker) => marker.getBoundingClientRect())
  const ends = rects.map((rect) => rect.left)
  ends.push(rectOf(inkedOf(lines.at(-1)).at(-1)).right)
  const tops = [
    box.top - lineHeight,
    ...rects.map((rect) => rect.top),
    box.bottom - lineHeight,
  ]
  return (
    Math.max(...ends) > edge + TOLERANCE ||
    tops.some((top, line) => line && top - tops[line - 1] > lineHeight * 1.5)
  )
}

const verify = (list) => {
  let wrong = list.filter(
    (state) => state.band && guarded(state, false, () => misfit(state)),
  )
  for (let step = 1; wrong.length; step += 1) {
    if (step > STEPS) {
      wrong.forEach(release)
      break
    }
    wrong.forEach((state) => tune(state, step * STEP))
    wrong = wrong.filter((state) => guarded(state, false, () => misfit(state)))
  }
}

const states = [...document.querySelectorAll('p[data-j]')].map((paragraph) => ({
  paragraph,
  plan: decode(paragraph.dataset.j),
}))

const guarded = (state, fallback, step) => {
  try {
    return step()
  } catch {
    release(state)
    return fallback
  }
}

const update = (list) => {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const readings = list.map((state) =>
    guarded(state, { usable: false }, () => measure(state, root)),
  )
  const staged = list.filter((state, at) =>
    guarded(state, false, () => stage(state, readings[at])),
  )
  if (document.fonts.status !== 'loaded') return false
  for (const { paragraph } of staged) paragraph.style.textAlign = 'left'
  const naturals = staged.map((state) =>
    guarded(state, null, () => naturalWidths(state)),
  )
  staged.forEach((state, at) => {
    if (naturals[at]) guarded(state, null, () => commit(state, naturals[at]))
  })
  verify(list)
  for (const { paragraph, band } of list) {
    paragraph.dataset.jState = band ? 'set' : 'native'
  }
  return true
}

let settle
window.__typesetReady = new Promise((resolve) => {
  settle = resolve
})

const fit = () => {
  if (update(states)) settle()
}

fit()

const byParagraph = new Map(states.map((state) => [state.paragraph, state]))
const queue = new Set()
let scheduled = false
const observer = new ResizeObserver((entries) => {
  for (const { target } of entries) queue.add(byParagraph.get(target))
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    const batch = [...queue]
    queue.clear()
    update(batch)
  })
})
for (const { paragraph } of states) observer.observe(paragraph)

let refitting = false

const refit = () => {
  if (refitting || document.fonts.status !== 'loaded') return
  refitting = true
  queueMicrotask(() => {
    refitting = false
    for (const state of states) state.width = 0
    fit()
  })
}

document.fonts.addEventListener('loadingdone', refit)
window.__typesetBusy = () => scheduled
