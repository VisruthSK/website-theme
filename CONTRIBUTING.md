# Contributing

Clone with submodules and install:

```sh
git clone --recurse-submodules <repository URL>
cd website-theme
pnpm install
pnpm dev
```

`pnpm dev` serves `examples/full`. Before opening a pull request, run:

```sh
pnpm check
pnpm knip
pnpm format
pnpm test
```

`pnpm test` builds both examples and runs the suite in Chromium, Firefox and WebKit. The unit tests alone are `pnpm exec playwright test --project=unit`.

## Ground rules

- Do not edit `astro-erudite/`. To change something it provides, add a file at the same path under `src/`.
- Everything that varies between sites belongs in `theme.json` and `config/theme.ts`, never in `src/`.
- Keep features optional: switching one off in `theme.json` must leave nothing behind in the build.
- Visual snapshots are generated on Linux. If a change moves pixels on purpose, label the pull request `update-snapshots` and the workflow commits new ones.
- Commit messages are one imperative sentence that says what changed.
