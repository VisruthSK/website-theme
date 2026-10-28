# website-theme

An Astro 7 theme for long-form writing, built on [astro-erudite](https://github.com/jktrn/astro-erudite) by enscribe. It keeps astro-erudite as a git submodule and overlays it: a file here replaces the astro-erudite file at the same path, and nothing inside astro-erudite is edited, so its new releases can be pulled in. It is not affiliated with or endorsed by the author of astro-erudite.

On top of astro-erudite it adds:

- Paragraphs broken into lines at build time and applied by a small script, with optical margins measured from the configured fonts.
- Footnotes as margin notes on wide screens, and Pandoc-style citations resolved against BibTeX files.
- Drop caps, callouts, maths, code blocks, sections with series, tags, feeds and Pagefind search.
- A strict Content Security Policy: no inline scripts or styles reach the built pages.
- Fonts subset at build time to the glyphs the pages use.

Everything that varies between sites lives in one validated `theme.json`.

## Using it

Add the theme to a site as a submodule at `theme/`, tracking the `release` branch:

```sh
git submodule add -b release <theme repository URL> theme
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
```

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

Content goes in `src/content/<collection>/` for each section and `src/content/pages/` for standalone pages, fonts in `src/assets/fonts/`, and bibliographies in `src/data/bibliographies/`. The build writes generated files to `src/generated/`, which should be ignored by git.

### Updating

Pull the newest release with `git submodule update --remote theme` and commit the new pointer. To have GitHub do it, add Dependabot to the site:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: gitsubmodule
    directory: /
    schedule:
      interval: monthly
```

Each pull request moves `theme/` to the latest release, and the site's own tests run on it before it merges.

## theme.json

`config/theme.schema.json` describes every key; point `$schema` at it for editor completion. The build fails with the key path when a value is missing, unknown or invalid.

| Key              | Contents                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `site`           | `title`, `description`, `href`, `author`, `locale`, `dir`, `postsPerPage`, `featuredPostCount`, `featured` post ids, optional `footer` text, `themeColor` and `manifest` colours.                                                                                                                                                                                        |
| `text`           | `recentDescription` and `searchPlaceholder`.                                                                                                                                                                                                                                                                                                                             |
| `sections`       | `slug`, `label` and content `collection` for each section, in display order. `pages` is reserved.                                                                                                                                                                                                                                                                        |
| `navigation`     | Sidebar links: `{ "section": slug }` or `{ "href", "label" }`.                                                                                                                                                                                                                                                                                                           |
| `socials`        | Footer links with an `icon` name. Icons are looked up in `src/icons/<name>.svg`, first in the site, then in the theme.                                                                                                                                                                                                                                                   |
| `palette`        | Named colours, emitted as `--<name>`.                                                                                                                                                                                                                                                                                                                                    |
| `colors`         | Values for the theme's colour tokens, either one value or `{ "light", "dark" }`. A palette name stands for `var(--<name>)`; anything else is used as CSS. Every token has a default taken from astro-erudite's greys, so `colors` can be omitted.                                                                                                                        |
| `fonts`          | `directory`, `body`, `heading` and optional `mono`, each with `family`, `fallback` and `faces` (`file`, `weight`, `style`), and an optional `dropCap` face, `smallCaps` (default `true`; set it to `false` for a body font without small capitals, which the build checks), and an optional `math` font (`family`, `file`; STIX Two Math is bundled and used otherwise). |
| `prose`          | `fontSize` (rem), `lineHeight` (rem) and `indent` (em), which the stylesheet and the typesetter both read, and `dropCapMinWords` (default `500`), the length a post needs before its opening paragraph gets a drop cap and small-capital opening words. A post can force or suppress them with `dropcap: true` or `dropcap: false`.                                      |
| `features`       | `typeset`, `citations`, `marginNotes`, `math`, `callouts`, `dropCap`, `search`, `externalLinkIcons`. All default to `true`; `false` removes the feature's plugins, routes, scripts and styles.                                                                                                                                                                           |
| `bibliographies` | Directory of `.bib` files, relative to the site root.                                                                                                                                                                                                                                                                                                                    |
| `prebuilt`       | Directories under `public/` holding HTML the theme should not rewrite or link-check, such as slide decks.                                                                                                                                                                                                                                                                |
| `unhinted`       | Paths that get no `Link: rel=preload` early hints in the generated `_headers`.                                                                                                                                                                                                                                                                                           |

`examples/full/theme.json` uses every key; `examples/minimal/theme.json` shows a site with different fonts and colours, one section and most features off.

The typesetter needs a regular body face at weight 400. Italic and bold are measured from their own files when configured and from the regular face otherwise. Paragraphs with code are left to the browser when no `mono` font is configured.

Two font settings exist because browsers render some fonts differently from how the typesetter measures them:

- `fonts.stripHinting` (default `false`) removes hinting instructions when fonts are subset. Without them, Chromium on Linux auto-hints some fonts and widens their glyphs, so keep it off unless you have checked your fonts.
- `fonts.dropCap.size` (default `5.9rem`) is the drop cap's font size. Browsers that support `initial-letter` size the cap themselves; pick the size at which the fallback matches them, or drop-cap paragraphs fall back to native justification.
- `fonts.dropCap.tolerance` (default `0.35`) is how far, in em, a browser's own sizing of the initial letter may differ from the plan before the paragraph keeps native justification. Browsers differ from each other and from letter to letter, so a site whose drop-cap paragraphs fall back can raise it; line verification still catches overflow.

## Overlay and shadowing

`@/*` resolves through an ordered list of directories, and the first file found wins:

| Where                        | Order                                               |
| ---------------------------- | --------------------------------------------------- |
| This repository              | `src/*`, `astro-erudite/src/*`                      |
| A site on the default branch | `src/*`, `theme/src/*`, `theme/astro-erudite/src/*` |
| A site on `release`          | `src/*`, `theme/src/*`                              |

A file in a higher layer replaces the same path below it. Theme code imports only through `@/`, so a site can replace any component, library module or stylesheet by adding a file at the same path. Upstream files are never edited.

Routes cannot be shadowed by path, so the theme registers its pages with `injectRoute` and skips any route whose file exists in the site's `src/pages/`. A site replaces the home page, for example, with its own `src/pages/index.astro`.

## Updating astro-erudite

`astro-erudite/` is a submodule pinned to a commit of astro-erudite. Dependabot checks it once a month. Since February 2026 it prefers the newest semver-tagged release on the tracked branch over newer untagged commits, so pull requests normally move to a release. Pull requests run the full test suite on both example sites.

## Stylesheets

Every page links one shared `base` stylesheet, identical across the site and cached once. Pages with an article add an `article` sheet (prose, callouts, tables, footnotes, citations), pages with maths add `math`, and the search page adds `search`. A page also links the small stylesheets of its own route. The build decides this from each page's final HTML (`src/lib/page-styles.ts`), keeping the cascade order of the source, and disabled features contribute no CSS at all.

Inside a theme stylesheet, `@feature name { … }` keeps its rules only while the feature is on, and `@when name { … }` moves them into one of those sheets.

## Sub-paths

The base path comes from `site.href`: `https://user.github.io/blog/` makes Astro's `base` `/blog`, and links, assets, feeds, the manifest, the sitemap and search results all follow it. Links written in content, such as `[About](/about/)`, gain the prefix too.

## Deploying

Both examples are complete sites. `public/_headers` in each carries the strict Content Security Policy the site is tested under, for hosts that read that file.

### GitHub Pages

`.github/workflows/pages.yml` builds `examples/full` and publishes it. Set _Settings → Pages → Source_ to _GitHub Actions_ and run the workflow.

- `site.href` in `examples/full/theme.json` is the published address, `https://visruthsk.github.io/website-theme/`; change it if the repository moves.
- Pages cannot send response headers, so the Content Security Policy in `public/_headers` does not apply there.
- Pages from a private repository needs a paid GitHub plan.
