---
title: 'Measuring the theme against astro-erudite'
date: 2026-10-27
description: 'Page weight, accessibility and Lighthouse scores for one post built with both.'
tags: ['performance', 'accessibility', 'typography']
bib: example
---

This theme is a hard fork of astro-erudite, so the first question anyone should ask is what the fork costs. It adds a build-time line breaker, margin notes and citations on top of what astro-erudite already does. If those additions made pages heavier or harder to use, they would not be worth having. This essay measures that by building the same post with both and comparing what a browser has to download, how quickly it paints and what an automated audit finds.[^scope]

## Method

Both sites were built from their own repositories with `astro build`, using Astro 7.4. The post you are reading was copied into astro-erudite unchanged apart from its front matter and its citations, which astro-erudite does not support. Each build was then served from a small static server that compresses responses with Brotli, as a host such as Cloudflare Pages does.

- Lighthouse 13.5.0 audited each page on its default mobile profile.
- Each page was audited 5 times and the median of each score is reported.
- Sizes are bytes on the wire after Brotli, not file sizes on disk.
- Every run started cold, with no cache.

:::note[What is being compared]
The two sites ship different fonts and different scripts. astro-erudite uses IBM Plex Sans as a variable font; this site's example uses static instances of the same family. The theme adds one script that applies the precomputed line breaks. Everything else that differs is part of the answer.
:::

## Results

| Measure | astro-erudite | This theme | Change |
| --- | ---: | ---: | ---: |
| Performance score | 84 | 100 | +16 |
| Accessibility score | 96 | 100 | +4 |
| Best practices score | 100 | 100 | 0 |
| SEO score | 92 | 100 | +8 |
| First contentful paint (s) | 2.8 | 1.3 | −55% |
| Largest contentful paint (s) | 3.8 | 1.7 | −56% |
| Total blocking time (ms) | 0 | 47 | +47 |
| Layout shift | 0.00 | 0.00 | 0 |
| HTML (kB) | 13.3 | 7.8 | −41% |
| CSS (kB) | 7.8 | 13.4 | +72% |
| JavaScript (kB) | 2.7 | 7.1 | +157% |
| Fonts (kB) | 441.6 | 54.7 | −88% |
| Images (kB) | 49.8 | 0.0 | −100% |
| **Total transfer (kB)** | **516.1** | **83.3** | **−84%** |

Differences are relative to astro-erudite, computed as

$$
\Delta = \frac{t - e}{e} \times 100\%
$$

where $t$ is the value for this theme and $e$ the value for astro-erudite. For the total transfer of this post, $e = 516.1$ kB and $t = 83.3$ kB, so $\Delta = −84\%$. A negative $\Delta$ means the theme sent fewer bytes.

## What the extra script costs

The line breaker runs when the site is built. For every justified paragraph it measures the text with the real font files, chooses the breaks and writes them into the page as a compact plan. The browser only has to apply the plan, which is why the script is small: 7.1 kB on the wire.[^plan] Justification computed in the browser would have to ship the font metrics and the algorithm to every reader, and would move text after the first paint.

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

Justified text can open wide gaps between words, which is hard on many readers. The theme avoids this by measuring the whole paragraph before choosing breaks, and when its script is blocked the page keeps the browser's own layout, so nothing is lost.

## Reproducing it

The sizes above come from a short script. It builds nothing; it reads an output directory and reports Brotli sizes by file type:

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

Run it against each site's `dist` directory and compare the totals. Use the median of several Lighthouse runs rather than one, because a single run on a laptop varies by several points.

## What to take from it

Most of the saving is fonts. The theme subsets every font file to the glyphs its pages use when it builds, so this post loads 54.7 kB of fonts where astro-erudite loads 441.6 kB. The home page follows the same pattern, at 38.4 kB against 211.0 kB in total.

The theme is not smaller in every column. It sends 13.4 kB of CSS to astro-erudite's 7.8 kB, and 7.1 kB of script to 2.7 kB, because the line breaker, margin notes and citations add their own rules and code. The script also shows up as blocking time, a median of 47 ms across the runs against none for astro-erudite, and as much as 162 ms on the worst run, probably because applying the plans happens on the main thread. Those costs are small next to what subsetting returns, but they are real.

The accessibility scores differ for two concrete reasons. Lighthouse reported low-contrast text and an anchor with no destination on astro-erudite's post, and nothing on the theme's. The theme's default palette keeps astro-erudite's greys but darkens its light-mode focus ring, which measures 1.9:1 against the page, below the 3:1 that WCAG asks for.

Two caveats apply. The sample is one post on one machine, so read differences of a point or two as noise. And astro-erudite's post header fetches the author's avatar from GitHub, which accounts for the 49.8 kB of images above. That is content, not theme, and it would disappear on a site without one.

[^scope]: One post is a small sample. The comparison says how the two themes treat the same markdown, not how every site built on them will behave.

[^plan]: A paragraph's plan is a list of numbers, one per line, encoded as text in an attribute on the paragraph. The browser reads it, sets each line's spacing and finishes.
