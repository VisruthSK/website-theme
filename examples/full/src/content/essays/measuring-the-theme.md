---
title: 'Measuring the theme against astro-erudite'
date: 2026-11-01
description: 'Page weight, site size, Lighthouse scores and accessibility for the same nine pages built with both themes.'
tags: ['performance', 'accessibility', 'typography']
bib: example
---

THIS CONTENT IS ENTIRELY LLM WRITTEN

This theme is built on astro-erudite, so the first question anyone should ask is what building on it costs. It adds a build-time line breaker, margin notes and citations on top of what astro-erudite already does. If those additions made pages heavier or harder to use, they would not be worth having. This essay measures that by building the same nine pages with both and comparing what a browser has to download, how quickly it paints and what an automated audit finds.[^scope]

## Method

The posts of this example site were copied into an unmodified astro-erudite 2.0.1, with only their front matter changed and their citations removed, since astro-erudite has no citations. Both sites were built with `astro build` on Astro 7.4 and use IBM Plex Sans. Nine pages exist in both builds: the home page, the listing, an essay with maths and code, a note with maths and code, two stories and a three page series.

Google's guidance on measuring performance says to separate lab data from field data, to keep conditions fixed between runs, and to take the median of several runs rather than trust one [@lighthouse-variability]. Field data needs real visitors, which an example site does not have, so everything here is lab data.

- Lighthouse 13.5.0 drove Chromium headless, one fresh browser per audit, so every audit starts cold.
- Each of the nine pages was audited 11 times per site on the default mobile profile and the median of the 11 is reported. Within a round the 18 audits ran in a shuffled order, so drift in the machine hits both sites alike. One warm-up round was discarded.
- Mobile uses Lighthouse's simulated throttling, a 4x slower CPU and a 1.6 Mbps link with 150 ms round trips. As a check against the model, five pages were audited again with applied throttling, where the browser really is slowed down, 7 times each. The default desktop profile covered all nine pages, 11 times each.
- Both builds were served by the same small static server, which compresses text with Brotli as most static hosts do and sends `Cache-Control: max-age=0`.
- Sizes are bytes on the wire after Brotli. The whole-site totals also give gzip, because not every host serves Brotli.

:::note[A server header can move the result]
An earlier run of this comparison served both sites with `Cache-Control: no-store`. A browser cannot reuse a preloaded font that was sent with `no-store`, so it downloaded each preloaded font twice, and the theme, which preloads more fonts than astro-erudite, lost about half a second of first paint. The header is part of the method, so it is stated here.
:::

The two sites use the same content, the same colours and the same typeface. astro-erudite ships it as variable font files and this theme as static instances subset to the glyphs the site uses. Everything else that differs is part of the answer.

## Results on a simulated phone

Each cell reads astro-erudite / this theme.

| Page | Performance | FCP (s) | LCP (s) | Transferred (kB) |
| --- | ---: | ---: | ---: | ---: |
| Home | 98 / 100 | 1.35 / 1.05 | 2.25 / 1.20 | 211.0 / 45.3 |
| Listing | 100 / 100 | 0.90 / 1.05 | 1.80 / 1.20 | 154.0 / 44.9 |
| Essay (maths and code) | 84 / 100 | 2.78 / 1.13 | 3.75 / 1.65 | 466.1 / 87.2 |
| Note (maths and code) | 84 / 100 | 2.78 / 1.12 | 3.75 / 1.65 | 465.4 / 86.8 |
| Story | 99 / 100 | 1.05 / 1.05 | 1.95 / 1.35 | 160.7 / 57.6 |
| Second story | 99 / 100 | 1.05 / 1.05 | 1.95 / 1.35 | 162.3 / 59.3 |
| Series index | 99 / 100 | 1.13 / 1.05 | 1.95 / 1.35 | 164.0 / 54.3 |
| Series part 1 | 99 / 100 | 1.13 / 1.05 | 1.95 / 1.35 | 164.1 / 54.4 |
| Series part 2 | 99 / 100 | 1.13 / 1.05 | 1.95 / 1.35 | 164.1 / 53.5 |

FCP is first contentful paint and LCP is largest contentful paint. Across the nine pages the median page sent 164.1 kB for astro-erudite and 54.4 kB for this theme, and the theme scored 100 for performance on every page. Its first paint is earlier on six pages, equal on two and later on one, the listing, by 0.15 s. Its largest paint is earlier on all nine.

The other categories and the two measures that matter for stability:

| Page | Accessibility | Best practices | SEO | TBT (ms) | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 95 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 0.000 / 0.000 |
| Listing | 95 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 0.000 / 0.000 |
| Essay (maths and code) | 96 / 100 | 100 / 100 | 92 / 100 | 0 / 0 | 0.000 / 0.000 |
| Note (maths and code) | 96 / 100 | 96 / 100 | 92 / 100 | 0 / 0 | 0.000 / 0.000 |
| Story | 96 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 0.000 / 0.000 |
| Second story | 96 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 0.000 / 0.000 |
| Series index | 96 / 100 | 100 / 100 | 92 / 100 | 0 / 0 | 0.000 / 0.000 |
| Series part 1 | 96 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 0.000 / 0.000 |
| Series part 2 | 96 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 0.000 / 0.000 |

Blocking time and layout shift are zero for both everywhere. The scores are whole numbers and most cells are identical across the 11 runs, so a medians table says what happened better than an interval would.

## Results on a desktop

On the default desktop profile every page scores 100 for both themes except the note, where astro-erudite scores 99. The differences are in the paints. On the two pages with maths and code the theme paints its first content at 0.28 s against 0.60 s, and on the other seven the two are within 0.05 s of each other, the theme ahead or level on all of them.

## Real throttling disagrees on three pages

Simulated throttling is a model of how the page would load, and it is Lighthouse's default because it is fast and stable. Applied throttling slows a real browser, so it is the check on the model. Each cell is again astro-erudite / this theme, medians of 7 runs.

| Page | Performance | FCP (s) | LCP (s) | TBT (ms) | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 99 / 100 | 1.57 / 1.51 | 1.57 / 1.51 | 0 / 0 | 0.006 / 0.000 |
| Listing | 99 / 100 | 1.59 / 1.49 | 1.59 / 1.49 | 0 / 0 | 0.000 / 0.000 |
| Essay (maths and code) | 95 / 96 | 1.69 / 2.33 | 1.69 / 2.33 | 33 / 0 | 0.113 / 0.000 |
| Note (maths and code) | 99 / 96 | 1.73 / 2.30 | 1.73 / 2.30 | 25 / 0 | 0.013 / 0.025 |
| Story | 99 / 98 | 1.58 / 2.01 | 1.58 / 2.01 | 1 / 0 | 0.017 / 0.000 |

The two methods agree on the home page and the listing, and disagree on the three content pages. There the theme paints 0.4 to 0.6 s later than astro-erudite. It scores 1 to 3 points lower on the note and the story and 1 point higher on the essay, where astro-erudite shifts its layout (0.113 against 0).

The cause is the font preloads. Taking the preloads off the story page brought its first paint under applied throttling from 2.01 s to 1.56 s, level with astro-erudite's 1.58 s. Under the simulated model the same change costs the page 0.45 s, 1.05 s to 1.50 s. Preloading starts the fonts as soon as the HTML arrives, which helps when a model charges for each round trip, and it also puts about 50 kB of fonts in competition with the stylesheets on a 1.6 Mbps link, which hurts when the link really is that slow. Setting `font-display: swap` instead of `block` made no difference (2.01 s against 2.02 s), so it is the bandwidth and not the invisible text.

The theme keeps `block` and the preloads on purpose: the line breaker measures paragraphs with the real font files, and text set in a fallback face would not fit its breaks. Which of the two measurements is closer to a reader depends on the reader's link, and a real visitor on a slow connection sees the second table.

## Maths pages and the math font

The first run of this comparison left the two maths pages at 99 on the simulated phone, and it was one metric: first paint at about 1.5 s. The stylesheet names a maths font, STIX Two Math, that the browser learns about only after it has fetched and parsed the CSS, so the font arrived one round trip later than the rest and the text waited for it. The theme now preloads that font on pages that contain maths. First paint on those two pages dropped from 1.50 s to 1.13 s and the score from 99 to 100, and pages without maths do not pay for the font.

## What the site weighs

A visitor reads one page, but the site is every page. These are all the files in each build.

| | astro-erudite | This theme |
| --- | ---: | ---: |
| Files | 72 | 90 (203 with search) |
| On disk | 2,548 kB | 1,283 kB (2,126 kB with search) |
| Over the wire, gzip | 2,162 kB | 382 kB (1,185 kB with search) |
| Over the wire, Brotli | 2,134 kB | 329 kB (1,130 kB with search) |

By type, over the wire with Brotli:

| Files | astro-erudite | This theme |
| --- | ---: | ---: |
| HTML | 130.0 kB | 91.7 kB |
| CSS | 7.4 kB | 17.3 kB |
| JavaScript | 2.9 kB | 8.2 kB |
| Fonts | 545.5 kB | 55.3 kB |
| Images | 1,447.3 kB | 1.9 kB |
| Everything else | 1.1 kB | 154.6 kB |
| Search index | none | 801.1 kB |

The theme's search index is its largest part, and a reader downloads only the fragments a query needs, not the 801 kB. astro-erudite's total is mostly the images that ship with its demo content, so the image row compares the demo posts and not the themes. The rows that do compare the themes are HTML and fonts, where the theme is smaller, and CSS and JavaScript, where it is larger.

## What the extra script costs

The line breaker runs when the site is built. For every justified paragraph it measures the text with the real font files, chooses the breaks and writes them into the page as a compact plan. The browser only has to apply the plan, which is why the script is small, about 4 kB on the wire.[^plan] Justification computed in the browser would have to ship the font metrics and the algorithm to every reader, and would move text after the first paint.

The break search follows the idea in Knuth and Plass's paper on paragraph breaking [@knuth1981]: choose all of a paragraph's breaks together so that the total looseness of its lines is as small as possible, instead of filling one line at a time.

## Accessibility

Layout choices are only good if everyone can read the result. The test suite for this theme runs an automated audit on every page of the example sites, in light and dark mode, and fails on any violation. Contrast is checked against the thresholds in WCAG 2.2 [@wcag22], which define the contrast ratio of two colours from their relative luminances:

$$
\text{ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}, \qquad L = 0.2126\,R + 0.7152\,G + 0.0722\,B
$$

Normal text needs a ratio of at least $4.5$, and large text and interface components at least $3$. The palette this example uses is astro-erudite's own, so the contrast figures are the same for both sites:

| Pair | Light | Dark | Needed |
| --- | ---: | ---: | ---: |
| Body text on the page | 15.9 | 16.3 | 4.5 |
| Muted text and the flourish colour | 5.8 | 9.1 | 4.5 |
| Focus ring in astro-erudite | 1.9 | 3.0 | 3 |
| Focus ring in this theme | 3.7 | 4.5 | 3 |

Lighthouse scored astro-erudite 95 or 96 for accessibility on all nine pages and this theme 100. On the essay the failing elements were the tag links under the title, which Lighthouse flagged for low contrast. The table's focus ring is a separate point: astro-erudite's measures 1.9:1 in light mode against the 3:1 WCAG asks for, and the theme darkens it.

Justified text can open wide gaps between words, which is hard on many readers. The theme avoids this by measuring the whole paragraph before choosing breaks, and when its script is blocked the page keeps the browser's own layout, so nothing is lost.

## Reproducing it

The sizes come from a short script. It builds nothing; it reads an output directory and reports Brotli sizes by file type:

```js
import { brotliCompressSync } from 'node:zlib'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

function sizes(directory, totals = {}) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) {
      sizes(path, totals)
      continue
    }
    const kind = extname(name)
    totals[kind] =
      (totals[kind] ?? 0) + brotliCompressSync(readFileSync(path)).length
  }
  return totals
}

console.log(sizes('dist'))
```

Run it against each site's `dist` directory and compare the totals. For the timings, serve each build with a Brotli static server and audit it with the Lighthouse command line, repeating each page several times and taking the median.

## What to take from it

The theme is smaller on every page, by about two thirds at the median, and most of the saving is fonts: it subsets each font file to the glyphs its pages use when it builds, so the median page loads 34 kB of fonts where astro-erudite loads 142 kB. It scores 100 for performance, accessibility, best practices and SEO on all nine pages on a simulated phone, and 100 for performance on all nine on a desktop.

It is not smaller in every column. It sends more CSS and more script than astro-erudite because the line breaker, margin notes and citations bring their own rules and code, and under real throttling its font preloads delay the first paint of the content pages by 0.4 to 0.6 s. That last result is the one to weigh against the scores: the model Lighthouse reports by default and the measurement of a really slowed browser rank the two themes differently on those pages.

The sample is one machine, one set of posts and lab conditions, so read differences of a point or two as noise, and read these numbers as how the two themes treat the same markdown and not as what any given site built on them will score.

[^scope]: The comparison says how the two themes treat the same markdown, not how every site built on them will behave.

[^plan]: A paragraph's plan is a list of numbers, one per line, encoded as text in an attribute on the paragraph. The browser reads it, sets each line's spacing and finishes.
