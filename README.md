# website-theme

An Astro 7 theme for long-form writing, built on [astro-erudite](https://github.com/jktrn/astro-erudite) by enscribe. It keeps astro-erudite as a git submodule and overlays it: a file here replaces the astro-erudite file at the same path, and nothing inside astro-erudite is edited, so its new releases can be pulled in. It is not affiliated with or endorsed by the author of astro-erudite.

From astro-erudite it keeps the native-CSS design system, the Sätteri Markdown processor, Expressive Code, Temml maths, series, the table of contents, heading anchors, callouts, tags, RSS and sitemaps. The theme adds:

- Line breaking at build time with [Justice](https://github.com/kitlangton/justice), applied by a small script, and optical margins ported from [Justif](https://github.com/lyallcooper/justif) and measured from the configured fonts.
- Footnotes set as margin notes on wide screens.
- Pandoc-style citations resolved against BibTeX files.
- Drop caps and small-capital opening words.
- Pagefind search.
- One validated `theme.json` for sections, navigation, colours, fonts and features, in place of astro-erudite's authors and projects.
- Fonts subset at build time to the glyphs the pages use, with swappable body, heading, mono and maths fonts.
- Hosting under a sub-path, and per-page stylesheets: a shared base plus article, maths and search sheets only where a page uses them.

## Using it

Add the theme to a site as a submodule at `theme/`, tracking the `release` branch:

```sh
git submodule add -b release https://github.com/VisruthSK/website-theme.git theme
```

`release` is a flattened tree with the astro-erudite files it needs copied in and a `package.json` listing what the theme needs to build. It only moves when a version is tagged, so following it means following releases. The default branch keeps astro-erudite as a nested submodule and is for working on the theme itself.

The site needs these files:

```yaml
# pnpm-workspace.yaml
packages:
  - theme

allowBuilds:
  esbuild: true
  sharp: true

overrides:
  expressive-code: 0.44.3
  satteri: 0.11.6
```

The overrides keep `@astrojs/markdown-satteri` and `satteri-expressive-code`, which ask for older releases, on the same Satteri and Expressive Code as the rest of the theme, so only one copy of each is installed.

```json
// package.json
{
  "private": true,
  "type": "module",
  "dependencies": {
    "astro": "^7.4.1",
    "website-theme": "workspace:*"
  }
}
```

```ts
// astro.config.ts
import { defineConfig } from 'astro/config'
import { themeConfig } from './theme/src/integrations/theme'

export default defineConfig(await themeConfig(new URL('./', import.meta.url)))
```

```ts
// src/content.config.ts
import { defineCollections } from '@/lib/collections'

export const collections = defineCollections()
```

```json
// tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "paths": { "@/*": ["./src/*", "./theme/src/*"] }
  },
  "exclude": ["dist", "src/generated"]
}
```

and a `theme.json`, described below. Because `theme/` is a workspace package, `pnpm install` brings in everything the theme builds with, so the site lists only Astro and the theme. Clone a site with `git clone --recurse-submodules`.

`themeConfig` takes a second argument, an Astro config merged over the theme's, for site-only settings such as the dev server port.

HTML files in `public/`, such as slide decks, are copied through untouched and left out of the theme's link check, font subsetting and style rewriting.

Content goes in `src/content/<collection>/` for each section and `src/content/pages/` for standalone pages, fonts in `src/assets/fonts/`, and bibliographies in `src/data/bibliographies/`. The build writes generated files to `src/generated/`, which should be ignored by git.

Set `rss: false` in a post's frontmatter to leave it out of every feed and the home page's recent list; it stays on the site, in listings and in search.

### Updating

Pull the newest release with `git submodule update --remote theme` and commit the new pointer. To have GitHub do it, add Dependabot to the site:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: gitsubmodule
    directory: /
    schedule:
      interval: weekly
```

Each pull request moves `theme/` to the latest release, and the site's own tests run on it before it merges.

## theme.json

`config/theme.schema.json` describes every key; point `$schema` at it for editor completion. The build fails with the key path when a value is missing, unknown or invalid. Everything a site customises lives here; `src/consts.ts` only reads these values and is not meant to be edited.

| Key              | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `site`           | `title`, `description`, `href`, `author`, `locale`, `dir`, `featuredPostCount` and `featured` post ids.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pages`          | Wording for the generated pages: `recent.description` and `search.placeholder`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `sections`       | `slug`, `label` and content `collection` for each section, in display order. `pages` is reserved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `navigation`     | Sidebar links: `{ "section": slug }` or `{ "href", "label" }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `footer`         | Optional `text` and `links`, each with an `icon` name. Icons are looked up in `src/icons/<name>.svg`, first in the site, then in the theme.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `brand`          | Modelled on the `color` section of a [brand.yml](https://posit-dev.github.io/brand-yml/brand/color.html) file, though it is not read from one: a `palette` of named colours, emitted as `--brand-<name>`, and the roles `background`, `foreground`, `primary`, `secondary` (muted text), `tertiary` (surfaces), `success`, `info`, `warning` and `danger`. Each role is one value or `{ "light", "dark" }`, and a value that names a palette colour uses it. Callouts take `info`, `success`, `warning`, `danger` and `primary`. The `background` also sets the browser theme colour and the web manifest colours. |
| `colors`         | Values for the theme's remaining colour tokens (`border`, `ring`, `flourish`, `highlight` and the rest), and overrides for any token a brand role would fill. One value or `{ "light", "dark" }`; a palette name stands for `var(--brand-<name>)`; anything else is used as CSS. Every token has a default.                                                                                                                                                                                                                                                                                                        |
| `fonts`          | `directory`, `body`, `heading` and optional `mono`, each with `family`, `fallback` and `faces` (`file`, `weight`, `style`), and an optional `dropCap` face, `smallCaps` (default `true`; set it to `false` for a body font without small capitals, which the build checks), and an optional `math` font (`family`, `file`; STIX Two Math is bundled and used otherwise).                                                                                                                                                                                                                                           |
| `prose`          | `fontSize` (rem), `lineHeight` (rem) and `indent` (em), which the stylesheet and the typesetter both read, and `dropCapMinWords` (default `500`), the length a post needs before its opening paragraph gets a drop cap and small-capital opening words. A post can force or suppress them with `dropcap: true` or `dropcap: false`.                                                                                                                                                                                                                                                                                |
| `features`       | `typeset`, `citations`, `marginNotes`, `math`, `callouts`, `dropCap`, `search`, `externalLinkIcons`. All default to `true`; `false` removes the feature's plugins, routes, scripts and styles.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `bibliographies` | Directory of `.bib` files, relative to the site root.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `unhinted`       | Paths that get no `Link: rel=preload` early hints in the generated `_headers`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`examples/full/theme.json` uses every key; `examples/minimal/theme.json` shows a site with different fonts and colours, one section and most features off.

The typesetter needs a regular body face at weight 400. Italic and bold are measured from their own files when configured and from the regular face otherwise. Paragraphs with code are left to the browser when no `mono` font is configured.

Two font settings exist because browsers render some fonts differently from how the typesetter measures them:

- `fonts.stripHinting` (default `false`) removes hinting instructions when fonts are subset. Without them, Chromium on Linux auto-hints some fonts and widens their glyphs, so keep it off unless you have checked your fonts.
- `fonts.dropCap.size` (default `5.9rem`) is the drop cap's font size. Browsers that support `initial-letter` size the cap themselves; pick the size at which the fallback matches them, or drop-cap paragraphs fall back to native justification.
- `fonts.dropCap.tolerance` (default `0.35`) is how far, in em, a browser's own sizing of the initial letter may differ from the plan before the paragraph keeps native justification. Browsers differ from each other and from letter to letter, so a site whose drop-cap paragraphs fall back can raise it; line verification still catches overflow.

## Lists

A list is a page of dated entries, such as books read or films seen, grouped under year headings with the newest first. It is not part of `theme.json`: the site owns the data file, the collection and the page.

```yaml
# src/data/reading.yaml
pale-fire:
  title: Pale Fire
  creator: Vladimir Nabokov
  published: Jun 1962
  rating: 7
  favorite: true
  started: 2026-08-14
  ended: 2026-09-03
  note: A book that seems designed to be read *twice*.
  link: 20250809-01
```

Notes support Markdown and are rendered at build time.

```ts
// src/content.config.ts
import { defineCollections, defineLedger } from '@/lib/collections'

export const collections = defineCollections({
  reading: defineLedger('src/data/reading.yaml', 'reviews'),
})
```

```astro
---
// src/pages/reading.astro
import Ledger from '@/components/Ledger.astro'
---

<Ledger
  title="Reading"
  description="Books I have read."
  linkLabel="Review"
/>
```

The component reads the collection named after the lowercase title and is reached at `/` plus that name; pass `entries` or `href` to change either. The `description` is the page description and the line under the heading.

Only `title` and `creator` are required. `rating` is a whole number from 1 to 10, or `DNF`. `published` prints what it holds as a normal date: `1962`, `Jun 1962`, `1962-06` and `19620601` all work, and anything else is printed as written. `url` makes the title a link to the work, ideally its DOI, while the rest of the card stays a permalink. `link` names an entry in the collection given as the second argument to `defineLedger`. Entries without an `ended` date are listed last under Undated, and a title read more than once gets `-01`, `-02` permalinks in the order the readings ended. Each entry is also its own search result.

## Overlay and shadowing

`@/*` resolves through an ordered list of directories, and the first file found wins:

| Where                        | Order                                               |
| ---------------------------- | --------------------------------------------------- |
| This repository              | `src/*`, `astro-erudite/src/*`                      |
| A site on the default branch | `src/*`, `theme/src/*`, `theme/astro-erudite/src/*` |
| A site on `release`          | `src/*`, `theme/src/*`                              |

A file in a higher layer replaces the same path below it. Theme code imports only through `@/`, so a site can replace any component, library module or stylesheet by adding a file at the same path. Upstream files are never edited.

Routes cannot be shadowed by path, so the theme registers its pages with `injectRoute` and skips any route whose file exists in the site's `src/pages/`. A site replaces the home page, for example, with its own `src/pages/index.astro`.

## Stylesheets

Every page links one shared `base` stylesheet, identical across the site and cached once. Pages with an article add an `article` sheet (prose, callouts, tables, footnotes, citations), pages with maths add `math`, and the search page adds `search`. A page also links the small stylesheets of its own route. The build decides this from each page's final HTML (`src/lib/page-styles.ts`), and disabled features contribute no CSS at all.

Inside a theme stylesheet, `@feature name { … }` keeps its rules only while the feature is on, and `@when name { … }` moves them into one of those sheets.

## Sub-paths

The base path comes from `site.href`: `https://user.github.io/blog/` makes Astro's `base` `/blog`, and links, assets, feeds, the manifest, the sitemap and search results all follow it. Links written in content, such as `[About](/about/)`, gain the prefix too.

## Deploying

Both examples are complete sites. `public/_headers` in each carries the strict Content Security Policy the site is tested under, for hosts that read that file.

### Build caches

The slowest build steps (the optical-margin tables, the line-break plans and the font subsets) are cached in `node_modules/.astro/website-theme`, keyed by the font bytes and the source that produces them, so a build with unchanged fonts and text is several times faster. Cloudflare Pages keeps `node_modules/.astro` between builds.

### GitHub Pages

`.github/workflows/pages.yml` builds `examples/full` and publishes it. Set _Settings → Pages → Source_ to _GitHub Actions_ and run the workflow.

- `site.href` in `examples/full/theme.json` is the published address, `https://visruthsk.github.io/website-theme/`; change it if the repository moves.
- Pages cannot send response headers, so the Content Security Policy in `public/_headers` does not apply there.

## Developing

```sh
git clone --recurse-submodules https://github.com/VisruthSK/website-theme.git
cd website-theme
pnpm install
pnpm dev
```

`pnpm dev` serves `examples/full`. `pnpm check`, `pnpm knip` and `pnpm format` lint; `pnpm test` builds both examples and runs the suite in Chromium, Firefox and WebKit, and `pnpm exec playwright test --project=unit` runs only the unit tests.

- Nothing inside `astro-erudite/` is edited. To change what it provides, add a file at the same path under `src/`.
- Anything that varies between sites belongs in `theme.json` and `config/theme.ts`, and a feature that is switched off leaves nothing in the build.
- Visual snapshots are generated on Linux. Run the _Update visual snapshots_ workflow from the Actions tab, or label a pull request `update-snapshots`.

### Updating astro-erudite

`astro-erudite/` is a submodule pinned to a commit of astro-erudite. To move to a new release, check out its tag inside the submodule (`git -C astro-erudite fetch --tags && git -C astro-erudite checkout v2.1.0`), commit the new pointer and run the suite.
