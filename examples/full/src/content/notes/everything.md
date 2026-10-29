---
title: 'Everything at Once'
date: 2025-02-03
description: 'Inline code, an external SVG, tables, maths, callouts, footnotes and citations in one note.'
tags: ['lorem', 'code']
bib: example
---

THIS CONTENT IS ENTIRELY LLM WRITTEN

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Inline code such as `const lorem = 'ipsum'` stays in the line, a variable like `dolor_sit` keeps its underscores, and a long command such as `pnpm exec astro build --root examples/full` wraps with the text around it.[^inline]

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.

## An external SVG

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. The diagram below is a separate file served from the site, not inline markup, so it is cached on its own and scales with the column.

![Three boxes labelled lorem, ipsum and dolor joined by arrows](/diagram.svg)

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.[^svg]

## Code, tables and maths

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

```ts title="lorem.ts"
export function ipsum(dolor: number, sit = 2): number {
  return dolor ** sit + Math.sqrt(dolor)
}
```

| Lorem | Ipsum | Dolor |
| --- | ---: | ---: |
| `alpha` | 1.5 | 20 |
| `beta` | 22.25 | 3 |
| `gamma` | 333 | 0.5 |

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Inline maths such as $e^{i\pi} + 1 = 0$ sits in the line, and display maths takes its own:

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
$$

## Callouts, quotes and citations

:::note[Lorem]
Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, with `inline code` inside a callout.
:::

> Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident [@cicero1914; see @knuth1984]. Et harum quidem rerum facilis est et expedita distinctio, nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus.[^long]

- Temporibus autem quibusdam et aut officiis debitis
- Itaque earum rerum hic tenetur a sapiente delectus
- Ut aut reiciendis voluptatibus maiores alias consequatur

Omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae, itaque earum rerum hic tenetur a sapiente delectus.

[^inline]: A short note with `inline code` and a [link to the Pagefind site](https://pagefind.app).

[^svg]: A note beside the diagram, long enough to wrap onto several lines in the margin so that its line breaks, its width and its alignment with the paragraph can be checked by eye.

[^long]: Another note, with a long unbroken address that has to wrap instead of running out of the margin: https://example.com/lorem/ipsum/dolor/sit/amet/consectetur/adipiscing/elit.
