# website-theme

A hard fork of [astro-erudite](https://github.com/jktrn/astro-erudite) by enscribe, kept as an overlay on top of it. This project is not affiliated with or endorsed by the author of astro-erudite.

The theme is an Astro 7 blog layout for long-form writing. It adds:

- Paragraphs broken into lines at build time and applied by a small script, with optical margins measured from the configured fonts.
- Footnotes as margin notes on wide screens, and Pandoc-style citations resolved against BibTeX files.
- Drop caps, callouts, maths, code blocks, sections with series, tags, feeds and Pagefind search.
- A strict Content Security Policy: no inline scripts or styles reach the built pages.
- Fonts subset at build time to the glyphs the pages use.

Everything that varies between sites lives in one validated `theme.json`.

## Using it

Add the theme to a site as a submodule at `theme/`:

```sh
git submodule add -b release <theme repository URL> theme
```

The `release` branch is a flattened tree with the upstream files it needs copied in. The default branch keeps upstream as a nested submodule and needs `git submodule update --init --recursive`.

The site then needs four files:

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
    "paths": { "@/*": ["./src/*", "./theme/src/*", "./theme/upstream/src/*"] }
  },
  "exclude": [
    "dist",
    "src/generated",
    "theme/upstream",
    "theme/example*",
    "theme/tests",
    "theme/scripts"
  ]
}
```

and `theme.json`, described below. The site's `package.json` must list the theme's dependencies, as in this repository's `package.json`. `themeConfig` takes a second argument, an Astro config merged over the theme's, for site-only settings such as the dev server port.

Content goes in `src/content/<collection>/` for each section and `src/content/pages/` for standalone pages, fonts in `src/assets/fonts/`, and bibliographies in `src/data/bibliographies/`. The build writes generated files to `src/generated/`, which should be ignored by git.

## theme.json

`config/theme.schema.json` describes every key; point `$schema` at it for editor completion. The build fails with the key path when a value is missing, unknown or invalid.

| Key              | Contents                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site`           | `title`, `description`, `href`, `author`, `locale`, `dir`, `postsPerPage`, `featuredPostCount`, `featured` post ids, optional `footer` text, `themeColor` and `manifest` colours.                                                                        |
| `text`           | `recentDescription` and `searchPlaceholder`.                                                                                                                                                                                                             |
| `sections`       | `slug`, `label` and content `collection` for each section, in display order. `pages` is reserved.                                                                                                                                                        |
| `navigation`     | Sidebar links: `{ "section": slug }` or `{ "href", "label" }`.                                                                                                                                                                                           |
| `socials`        | Footer links with an `icon` name. Icons are looked up in `src/icons/<name>.svg`, first in the site, then in the theme.                                                                                                                                   |
| `palette`        | Named colours, emitted as `--<name>`.                                                                                                                                                                                                                    |
| `colors`         | Values for the theme's colour tokens, either one value or `{ "light", "dark" }`. A palette name stands for `var(--<name>)`; anything else is used as CSS. Every token has a default taken from astro-erudite's greys, so `colors` can be omitted.        |
| `fonts`          | `directory`, `body`, `heading` and optional `mono`, each with `family`, `fallback` and `faces` (`file`, `weight`, `style`), and an optional `dropCap` face, and an optional `math` font (`family`, `file`; STIX Two Math is bundled and used otherwise). |
| `prose`          | `fontSize` (rem), `lineHeight` (rem) and `indent` (em). The stylesheet and the typesetter both read these.                                                                                                                                               |
| `features`       | `typeset`, `citations`, `marginNotes`, `math`, `callouts`, `dropCap`, `search`, `externalLinkIcons`. All default to `true`; `false` removes the feature's plugins, routes, scripts and styles.                                                           |
| `bibliographies` | Directory of `.bib` files, relative to the site root.                                                                                                                                                                                                    |
| `prebuilt`       | Directories under `public/` holding HTML the theme should not rewrite or link-check, such as slide decks.                                                                                                                                                |
| `unhinted`       | Paths that get no `Link: rel=preload` early hints in the generated `_headers`.                                                                                                                                                                           |

`example/theme.json` uses every key; `example-minimal/theme.json` shows a site with different fonts and colours, one section and most features off.

The typesetter needs a regular body face at weight 400. Italic and bold are measured from their own files when configured and from the regular face otherwise. Paragraphs with code are left to the browser when no `mono` font is configured.

Two font settings exist because browsers render some fonts differently from how the typesetter measures them:

- `fonts.stripHinting` (default `false`) removes hinting instructions when fonts are subset. Without them, Chromium on Linux auto-hints some fonts and widens their glyphs, so keep it off unless you have checked your fonts.
- `fonts.dropCap.size` (default `5.9rem`) is the drop cap's font size. Browsers that support `initial-letter` size the cap themselves; pick the size at which the fallback matches them, or drop-cap paragraphs fall back to native justification.

## Overlay and shadowing

`@/*` resolves through an ordered list of directories, and the first file found wins:

| Where                        | Order                                          |
| ---------------------------- | ---------------------------------------------- |
| This repository              | `src/*`, `upstream/src/*`                      |
| A site on the default branch | `src/*`, `theme/src/*`, `theme/upstream/src/*` |
| A site on `release`          | `src/*`, `theme/src/*`                         |

A file in a higher layer replaces the same path below it. Theme code imports only through `@/`, so a site can replace any component, library module or stylesheet by adding a file at the same path. Upstream files are never edited.

Routes cannot be shadowed by path, so the theme registers its pages with `injectRoute` and skips any route whose file exists in the site's `src/pages/`. A site replaces the home page, for example, with its own `src/pages/index.astro`.

## Updating from upstream

`upstream/` is a submodule pinned to a commit of astro-erudite. A weekly workflow (`.github/workflows/upstream.yml`) opens a pull request when astro-erudite publishes a newer release tag that contains the pinned commit; commits to upstream's main branch are ignored. The tests run on both example sites before it can merge. After merging, the next release picks up the new files. The workflow needs _Settings → Actions → Allow GitHub Actions to create pull requests_.

## Deploying an example

Both examples are complete sites. On Cloudflare Pages, connect the repository (with submodules enabled) and set:

| Setting                | Value                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| Build command          | `pnpm install --frozen-lockfile && pnpm exec astro build --root example` |
| Build output directory | `example/dist`                                                           |
| Node version           | `NODE_VERSION` set to the version in `.node-version`                     |

Use `example-minimal` for the second site. Each example's `public/_headers` carries the strict Content Security Policy the site is tested under.
