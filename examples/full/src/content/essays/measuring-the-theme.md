---
title: 'Measuring the theme against astro-erudite'
date: 2026-11-01
description: 'The same nine pages built with astro-erudite and with this theme: three times smaller, 1.4 to 2.3 times faster to the largest paint, and slower to first paint on a really slow link.'
tags: ['performance', 'accessibility', 'typography']
bib: example
---

THIS CONTENT IS ENTIRELY LLM WRITTEN

This theme is built on astro-erudite, so the first question anyone should ask is what building on it costs. It adds a build-time line breaker, margin notes and citations on top of what astro-erudite already does. If those additions made pages heavier or slower, they would not be worth having. This essay builds the same nine pages with both and measures what a browser has to download, how quickly it paints and what an automated audit finds.[^scope]

## The short version

| Measure | astro-erudite | This theme | Difference |
| --- | ---: | ---: | --- |
| Bytes sent for the median page | 164 kB | 54 kB | **3.0 times smaller** |
| Bytes sent for a page with maths and code | 466 kB | 87 kB | **5.3 times smaller** |
| Fonts on the median page | 142 kB | 34 kB | **4.2 times smaller** |
| Whole site, all files, Brotli | 2,134 kB | 329 kB | **6.5 times smaller** |
| Largest paint, median page, simulated phone | 1.95 s | 1.35 s | **1.4 times faster** |
| Largest paint, page with maths and code | 3.75 s | 1.65 s | **2.3 times faster** |
| First paint, page with maths and code | 2.78 s | 1.13 s | **2.5 times faster** |
| Performance score, median page | 99 | 100 | **+1** |
| Accessibility score, median page | 96 | 100 | **+4** |
| First paint, story page, really throttled | 1.58 s | 2.01 s | 0.43 s slower |

The last row is the one to remember. The theme wins on weight and on the simulated phone everywhere, and loses on first paint on three pages when the browser is really slowed to a slow connection. The sections below show where each number comes from.

## How much less it sends

![Kilobytes sent for each of nine pages, astro-erudite against this theme: the theme sends less on every page, about a fifth as much on the two pages with maths and code](/measure-weight.svg)

The two pages with maths and code are the largest in both builds because they load a code highlighting stylesheet and a maths font as well. The theme still sends 87 kB for them against astro-erudite's 466 kB, and the gap comes from the fonts.

## How much sooner it paints

![Seconds until the largest element is painted on a simulated phone, nine pages: the theme is faster on every page, most of all on the two pages with maths and code](/measure-lcp.svg)

On the two pages that the benchmark stresses most, the largest paint arrives 2.1 s sooner. On the plain stories it is 0.6 s sooner. On the listing, first paint is the one place where astro-erudite is ahead, 0.90 s to 1.05 s, and the largest paint is still 0.6 s sooner on the theme.

## What the audit says

Lighthouse scores each page from 0 to 100. Medians of 11 runs per page, across the nine pages:

| Category | astro-erudite | This theme |
| --- | --- | --- |
| Performance | 84 to 100, median 99 | **100 on every page** |
| Accessibility | 95 or 96 | **100 on every page** |
| Best practices | 100 on eight pages, 96 on one | 100 on every page |
| SEO | 100 on six pages, 92 on three | 100 on every page |
| Blocking time | 0 ms | 0 ms |
| Layout shift | 0.000 | 0.000 |

The scores are whole numbers and most cells are identical across the 11 runs, so a median says what happened better than an interval would. On a desktop every page scores 100 on both themes except the note, where astro-erudite scores 99, and the theme paints the two maths pages in 0.28 s against 0.60 s.

## Where the theme is slower

Simulated throttling is a model of how the page would load, and it is Lighthouse's default because it is fast and stable. Applied throttling slows a real browser to the same 1.6 Mbps link and 150 ms round trips, so it is the check on the model. Medians of 7 runs on five pages:

![Seconds until first paint with the browser really slowed, five pages: the theme is up to a tenth of a second faster on the home page and listing and four tenths to six tenths slower on the essay, the note and the story](/measure-real.svg)

The two methods agree on the home page and the listing, and disagree on the three content pages. There the theme paints 0.4 to 0.6 s later. It scores 1 to 3 points lower on the note and the story and 1 point higher on the essay, where astro-erudite shifts its layout (0.113 against 0).

The cause is the font preloads. Taking them off the story page brought its first paint under applied throttling from 2.01 s to 1.56 s, level with astro-erudite's 1.58 s. Under the simulated model the same change costs the page 0.45 s, 1.05 s to 1.50 s. Preloading starts the fonts as soon as the HTML arrives, which helps when a model charges for each round trip, and it also puts about 50 kB of fonts in competition with the stylesheets on a 1.6 Mbps link, which hurts when the link really is that slow. Setting `font-display: swap` instead of `block` made no difference (2.01 s against 2.02 s), so it is the bandwidth and not the invisible text.

The theme keeps `block` and the preloads on purpose: the line breaker measures paragraphs with the real font files, and text set in a fallback face would not fit its breaks. Which of the two measurements is closer to a reader depends on the reader's link.

## What the site weighs

A visitor reads one page, but the site is every page. These are all the files in each build:

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

## How it was measured

The posts of this example site were copied into an unmodified astro-erudite 2.0.1, with only their front matter changed and their citations removed, since astro-erudite has no citations. Both sites were built with `astro build` on Astro 7.4 and use IBM Plex Sans, which astro-erudite ships as variable font files and this theme as static instances subset to the glyphs the site uses. Nine pages exist in both builds: the home page, the listing, an essay with maths and code, a note with maths and code, two stories and a three page series.

Google's guidance on measuring performance says to separate lab data from field data, to keep conditions fixed between runs, and to take the median of several runs rather than trust one [@lighthouse-variability]. Field data needs real visitors, which an example site does not have, so everything here is lab data.

- Lighthouse 13.5.0 drove Chromium headless, one fresh browser per audit, so every audit starts cold.
- Each of the nine pages was audited 11 times per site on the default mobile profile and the median of the 11 is reported. Within a round the 18 audits ran in a shuffled order, so drift in the machine hits both sites alike. One warm-up round was discarded.
- Mobile uses Lighthouse's simulated throttling, a 4x slower CPU and a 1.6 Mbps link with 150 ms round trips. Five pages were audited again with applied throttling, 7 times each, and the default desktop profile covered all nine pages, 11 times each.
- Both builds were served by the same small static server, which compresses text with Brotli as most static hosts do and sends `Cache-Control: max-age=0`.
- Sizes are bytes on the wire after Brotli. The whole-site totals also give gzip, because not every host serves Brotli.

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

The theme sends about a third as much per page and a sixth as much across the whole site, and most of the saving is fonts: it subsets each font file to the glyphs its pages use when it builds. It scores 100 for performance, accessibility, best practices and SEO on all nine pages on a simulated phone, and 100 for performance on all nine on a desktop.

It is not better in every column. It sends more CSS and more script than astro-erudite because the line breaker, margin notes and citations bring their own rules and code, and under real throttling its font preloads delay the first paint of the content pages by 0.4 to 0.6 s. The default Lighthouse model and the measurement of a really slowed browser rank the two themes differently on those pages, and both are reported above.

The sample is one machine, one set of posts and lab conditions, so read differences of a point or two as noise, and read these numbers as how the two themes treat the same markdown and not as what any given site built on them will score.

[^scope]: The comparison says how the two themes treat the same markdown, not how every site built on them will behave.

[^plan]: A paragraph's plan is a list of numbers, one per line, encoded as text in an attribute on the paragraph. The browser reads it, sets each line's spacing and finishes.
