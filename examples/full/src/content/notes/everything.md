---
title: 'Everything at Once'
date: 2025-02-03
description: 'Inline code, an external SVG, tables, maths, callouts, footnotes and citations in one note.'
tags: ['code', 'features']
bib: example
---

THIS CONTENT IS ENTIRELY LLM WRITTEN

This note uses every kind of content the theme sets, so that one page can show how they sit together. It is a short working document: a few paragraphs of prose with `inline code` in the line, a command such as `pnpm exec astro build --root examples/full` that has to wrap with the text around it, and a few notes in the margin.[^inline]

## An external SVG

The diagram below is a separate file served from the site, not inline markup. That keeps it cacheable on its own, and it scales with the column whatever the width of the screen.

![Three boxes labelled tell, listen and retell joined by arrows](/diagram.svg)

A caption is not needed when the surrounding sentence says what the picture shows, and the alternative text carries the same description for readers who cannot see it.[^svg]

## Code, tables and maths

Code blocks are highlighted at build time, so no script runs in the reader's browser, and the block keeps its own title and copy button:

```ts title="count.ts"
export function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
```

Tables line their numbers up on the right and keep the same rhythm as the text above them:

| Story | Words | Year |
| --- | ---: | ---: |
| `The Selfish Giant` | 1,652 | 1888 |
| `The Frog-Prince` | 1,192 | 1812 |
| `The Elves and the Shoemaker` | 743 | 1812 |

Inline maths such as $e^{i\pi} + 1 = 0$ sits in the line, and display maths takes a line of its own:

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
$$

## Callouts, quotations and citations

:::note[Callouts]
A callout can hold `inline code`, a [link](https://pagefind.app) and more than one paragraph of text.
:::

:::tip[Quotations]
A block quotation keeps the body typeface and is set apart by its rule, as in this sentence from Wilde:
:::

> It was a large lovely garden, with soft green grass.

Citations are numbered in the order they first appear and link to the reference list at the foot of the page, as with the story quoted above [@wilde1888]. A group takes one set of brackets [see @knuth1984; @knuth1981], and a locator can follow the key.[^citation]

- Lists keep the same measure and spacing as paragraphs.
- Nested lists indent by a fixed step.

1. Ordered lists number their items in the same colour as the text around them.
2. The numbers are text, so they need the same contrast as text.
3. A third item shows the numbers lining up.

Every one of these features can be switched off in `theme.json`, and the build then leaves no trace of it in the output. The second example site does exactly that, so it makes a useful comparison with this page: it has no margin notes, no maths and no citations, and its pages are correspondingly lighter.

[^inline]: A note with `inline code` and a [link to the Pagefind site](https://pagefind.app), set in the margin beside the line that mentions it.

[^svg]: A longer note, beside the diagram, long enough to wrap onto several lines in the margin so that its line breaks, its width and its alignment with the paragraph can be checked by eye.

[^citation]: A note with a long unbroken address that has to wrap instead of running out of the margin: https://example.com/stories/the-selfish-giant/chapter-one/paragraph-two/sentence-three.
