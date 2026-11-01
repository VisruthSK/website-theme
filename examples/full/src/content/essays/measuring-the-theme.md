---
title: 'Measuring the theme against astro-erudite'
date: 2026-11-01
description: 'The same nine pages built with astro-erudite and with this theme: a third of the bytes, an earlier largest paint, and a later first paint on a really slow link.'
tags: ['performance', 'accessibility', 'typography']
bib: example
---

THIS CONTENT IS ENTIRELY LLM WRITTEN

This theme is built on astro-erudite and adds a build-time line breaker, margin notes and citations. I built the same nine pages with both and compared what a browser downloads, how soon it paints and what Lighthouse scores.[^scope]

## Summary

| Measure | astro-erudite | This theme | Difference |
| --- | ---: | ---: | --- |
| Bytes sent, median page | 164 kB | 54 kB | 3.0 times smaller |
| Bytes sent, page with maths and code | 466 kB | 87 kB | 5.3 times smaller |
| Fonts sent, median page | 142 kB | 34 kB | 4.2 times smaller |
| Every file in the build, Brotli | 2,134 kB | 329 kB | 6.5 times smaller |
| Largest paint, median page, simulated phone | 1.95 s | 1.35 s | 1.4 times faster |
| Largest paint, page with maths and code | 3.75 s | 1.65 s | 2.3 times faster |
| First paint, page with maths and code | 2.78 s | 1.13 s | 2.5 times faster |
| Performance score, median page | 99 | 100 | 1 point higher |
| Accessibility score, median page | 96 | 100 | 4 points higher |
| First paint, story, really throttled | 1.58 s | 2.01 s | 0.43 s slower |

The theme sends less on every page and paints its largest element sooner on every page on a simulated phone. When the browser is really throttled to a slow connection, it paints first content 0.4 to 0.6 s later on three of the five pages tested.

## Page weight

![Kilobytes sent for each of nine pages, astro-erudite against this theme: the theme sends less on every page, about a fifth as much on the two pages with maths and code](/measure-weight.svg)

The two pages with maths and code are the heaviest in both builds, since they also load the code stylesheet and a maths font. The theme sends 87 kB for them against astro-erudite's 466 kB, and fonts are nearly all of the gap: 71 kB against 442 kB.

## Largest paint

![Seconds until the largest element is painted on a simulated phone, nine pages: the theme is faster on every page, most of all on the two pages with maths and code](/measure-lcp.svg)

Largest paint comes 2.1 s sooner on the two pages with maths and code, 1.05 s sooner on the home page and 0.6 s sooner on the other six. First paint is level or earlier on the theme everywhere except the listing, where astro-erudite is ahead by 0.15 s (0.90 s against 1.05 s).

## Lighthouse scores

Medians of 11 runs per page across the nine pages:

| Category | astro-erudite | This theme |
| --- | --- | --- |
| Performance | 84 to 100, median 99 | 100 on every page |
| Accessibility | 95 or 96 | 100 on every page |
| Best practices | 100 on eight pages, 96 on one | 100 on every page |
| SEO | 100 on six pages, 92 on three | 100 on every page |
| Blocking time | 0 ms | 0 ms |
| Layout shift | 0.000 | 0.000 |

The scores are whole numbers and most are identical across the 11 runs, so a median says more than an interval would. On a desktop every page scores 100 on both themes except the note, where astro-erudite scores 99. The theme paints the two maths pages in 0.28 s against 0.60 s.

## Real throttling

Lighthouse's default mobile score uses simulated throttling, which models the page load instead of slowing the browser. Applied throttling slows a real browser to the same 1.6 Mbps link and 150 ms round trips. I audited five pages 7 times each this way.

![Seconds until first paint with the browser really slowed, five pages: the theme is up to a tenth of a second faster on the home page and listing and four tenths to six tenths slower on the essay, the note and the story](/measure-real.svg)

The two methods agree on the home page and the listing. On the essay, the note and the story the theme paints 0.4 to 0.6 s later. It scores 1 to 3 points lower on the note and the story, and 1 point higher on the essay, where astro-erudite shifts its layout (0.113 against 0).

The font preloads cause the delay. With them removed, the story's first paint under applied throttling dropped from 2.01 s to 1.56 s, level with astro-erudite's 1.58 s. Under simulated throttling the same change made it 0.45 s slower, from 1.05 s to 1.50 s. A preload starts a font as soon as the HTML arrives, which the simulation rewards because it charges for every round trip. On a real 1.6 Mbps link the roughly 50 kB of fonts compete with the stylesheets for bandwidth. Switching `font-display` from `block` to `swap` changed nothing (2.01 s against 2.02 s), so the invisible text is not the cost.

The theme keeps `block` and the preloads because the line breaker measures paragraphs with the real font files, and text set in a fallback face would not fit its breaks.

## Whole-site size

Every file in each build:

| Measure | astro-erudite | This theme |
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

The search index is the theme's largest part, though a search downloads only the index fragments it needs. astro-erudite's total is mostly the images in its demo posts, so that row compares the demo content, not the themes. The theme is smaller in HTML and fonts and larger in CSS and JavaScript.

## Method

The posts of this example site were copied into an unmodified astro-erudite 2.0.1 with only their front matter changed and their citations removed, since astro-erudite has no citations. Both sites were built with `astro build` on Astro 7.4 and use IBM Plex Sans, which astro-erudite ships as variable font files and this theme as static instances subset to the glyphs the site uses. Nine pages exist in both builds: the home page, the listing, an essay with maths and code, a note with maths and code, two stories and a three page series.

Everything here is lab data, since an example site has no visitors to collect field data from. Following Google's advice on variability, conditions were held fixed and each result is a median of several runs [@lighthouse-variability].

- Lighthouse 13.5.0 drove headless Chromium with a fresh browser for every audit, so each starts cold.
- Each page was audited 11 times per site on the default mobile profile. Within a round the 18 audits ran in shuffled order so that drift in the machine hits both sites alike, and one warm-up round was discarded.
- The mobile profile uses simulated throttling: a 4x slower CPU and a 1.6 Mbps link with 150 ms round trips. The desktop profile covered all nine pages, 11 times each.
- Both builds were served by the same static server, which compresses text with Brotli and sends `Cache-Control: max-age=0`.
- Sizes are bytes on the wire after Brotli. The whole-site totals also give gzip, since not every host serves Brotli.

## The line breaker

The line breaker runs when the site is built. For every justified paragraph it measures the text with the real font files, chooses the breaks and writes them into the page as a compact plan. The browser only applies the plan, which keeps the script to about 4 kB on the wire.[^plan] Doing the same work in the browser would mean shipping the font metrics and the algorithm to every reader and moving text after first paint.

The break search follows Knuth and Plass [@knuth1981]: it chooses all of a paragraph's breaks together to minimise the total looseness of its lines, instead of filling one line at a time.

## Accessibility

The theme's test suite runs an automated audit on every page of the example sites, in light and dark mode, and fails on any violation. Contrast is checked against WCAG 2.2 [@wcag22], which defines the contrast ratio of two colours from their relative luminances:

$$
\text{ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}, \qquad L = 0.2126\,R + 0.7152\,G + 0.0722\,B
$$

Normal text needs a ratio of at least $4.5$, and large text and interface components at least $3$. The example uses astro-erudite's palette, so the contrast figures are the same for both sites:

| Pair | Light | Dark | Needed |
| --- | ---: | ---: | ---: |
| Body text on the page | 15.9 | 16.3 | 4.5 |
| Muted text and the flourish colour | 5.8 | 9.1 | 4.5 |
| Focus ring in astro-erudite | 1.9 | 3.0 | 3 |
| Focus ring in this theme | 3.7 | 4.5 | 3 |

Lighthouse scored astro-erudite 95 or 96 for accessibility on all nine pages and the theme 100. On the essay it flagged the tag links under the title for low contrast. Separately, astro-erudite's focus ring measures 1.9:1 in light mode against the 3:1 WCAG asks for, and the theme darkens it.

Justified text can open wide gaps between words. The theme measures the whole paragraph before choosing breaks to keep them small, and if its script is blocked the page falls back to the browser's own layout.

## Reproducing it

The sizes come from a short script that builds nothing. It reads an output directory and reports Brotli sizes by file type:

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

Run it against each site's `dist` directory and compare the totals. For the timings, serve each build with a Brotli static server and audit it with the Lighthouse command line, repeating each page and taking the median.

## Limits

The theme gives up some things for those numbers. It sends more CSS and JavaScript than astro-erudite, because the line breaker, margin notes and citations bring their own rules and code. On a really slow link its font preloads delay first paint on content pages by 0.4 to 0.6 s.

This is one machine, one set of posts and lab conditions. Differences of a point or two are noise. The numbers describe how the two themes treat the same markdown, not what a given site built on them will score.

[^scope]: The comparison says how the two themes treat the same markdown, not how every site built on them will behave.

[^plan]: A paragraph's plan is a list of numbers, one per line, encoded as text in an attribute on the paragraph. The browser reads it, sets each line's spacing and finishes.
