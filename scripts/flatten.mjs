import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { builtinModules } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

const theme = resolve(import.meta.dirname, '..')
const astroErudite = join(theme, 'astro-erudite', 'src')
const [target] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const out = resolve(target ?? join(theme, '.release'))
const EXTENSIONS = [
  '',
  '.ts',
  '.js',
  '.mjs',
  '.astro',
  '/index.ts',
  '/index.js',
]
const SPECIFIER =
  /(?:from\s+|import\s*\(?\s*|@import\s+|url\(\s*)['"]([^'"]+)['"]|['"]((?:@\/|\.\.?\/)[^'"\s]+)['"]/g

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
for (const entry of ['src', 'config', 'README.md', 'LICENSE', 'LICENSES']) {
  cpSync(join(theme, entry), join(out, entry), {
    recursive: true,
    filter: (path) => !/[\\/]generated(?:[\\/]|$)/.test(path),
  })
}

const BUNDLED_ASSETS = ['assets/fonts/STIXTwoMath-Regular.woff2']
for (const asset of BUNDLED_ASSETS) {
  mkdirSync(dirname(join(out, 'src', asset)), { recursive: true })
  cpSync(join(astroErudite, asset), join(out, 'src', asset))
}

const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })

const find = (base) =>
  EXTENSIONS.map((extension) => base + extension).find(
    (path) => existsSync(path) && statSync(path).isFile(),
  )

const queue = files(join(out, 'src'))
const copied = new Set()
const fromUpstreamFiles = new Set()

function include(source) {
  const target = join(out, 'src', relative(astroErudite, source))
  if (existsSync(target) || copied.has(source)) return
  copied.add(source)
  fromUpstreamFiles.add(target)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target)
  queue.push(target)
}

while (queue.length) {
  const file = queue.pop()
  if (!/\.(?:ts|js|mjs|astro|css)$/.test(file)) continue
  const fromUpstream = relative(join(out, 'src'), file)
  for (const match of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
    const specifier = (match[1] ?? match[2]).split('?')[0]
    if (specifier.startsWith('@/generated/')) continue
    if (
      !match[1] &&
      !specifier.startsWith('@/') &&
      !fromUpstreamFiles.has(file)
    )
      continue
    let base
    if (specifier.startsWith('@/')) base = specifier.slice(2)
    else if (specifier.startsWith('.'))
      base = relative(
        astroErudite,
        resolve(dirname(join(astroErudite, fromUpstream)), specifier),
      )
    else continue
    if (base.startsWith('..')) continue
    if (find(join(out, 'src', base))) continue
    const source = join(astroErudite, base)
    if (existsSync(source) && statSync(source).isDirectory()) {
      files(source).forEach(include)
      continue
    }
    const found = find(source)
    if (found) include(found)
    else if (specifier.startsWith('@/'))
      throw new Error(`${relative(out, file)} imports missing ${specifier}`)
  }
}

const commit = execFileSync(
  'git',
  ['-C', join(theme, 'astro-erudite'), 'rev-parse', 'HEAD'],
  {
    encoding: 'utf8',
  },
).trim()
mkdirSync(join(out, 'LICENSES'), { recursive: true })
cpSync(
  join(theme, 'astro-erudite', 'LICENSE'),
  join(out, 'LICENSES', 'astro-erudite-MIT'),
)
writeFileSync(
  join(out, 'NOTICE'),
  `${readFileSync(join(theme, 'NOTICE'), 'utf8').trimEnd()}\n\nThis release includes files from astro-erudite at commit ${commit}.\n`,
)
const { name, description, license, type, dependencies } = JSON.parse(
  readFileSync(join(theme, 'package.json'), 'utf8'),
)
const { astro, ...runtime } = dependencies
writeFileSync(
  join(out, 'package.json'),
  `${JSON.stringify(
    {
      name,
      description,
      license,
      type,
      private: true,
      dependencies: runtime,
      peerDependencies: { astro },
    },
    null,
    2,
  )}
`,
)
console.log(
  `Flattened ${copied.size} astro-erudite files into ${relative(theme, out) || out}`,
)

const BARE = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
const IGNORED = /^(?:\.|@\/|node:|virtual:|astro:|astro\/)/

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.(?:ts|js|mjs|astro)$/.test(entry.name) ? [path] : []
  })
}

function undeclared(directory, declared) {
  const missing = new Set()
  for (const file of sources(directory)) {
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(BARE)) {
      if (IGNORED.test(specifier) || builtinModules.includes(specifier))
        continue
      const [first, second] = specifier.split('/')
      const name = first.startsWith('@') ? `${first}/${second}` : first
      if (!declared.has(name) && !declared.has(`@types/${name}`)) {
        missing.add(`${name} (${relative(out, file)})`)
      }
    }
  }
  return [...missing]
}

const declared = new Set([
  ...Object.keys(dependencies),
  ...Object.keys({ astro }),
])
const missing = [
  ...undeclared(join(out, 'src'), declared),
  ...undeclared(join(out, 'config'), declared),
]
if (missing.length) {
  console.error(
    `The release imports packages its package.json does not list:\n${missing.join('\n')}`,
  )
  process.exit(1)
}

if (process.argv.includes('--check')) {
  const site = join(tmpdir(), `theme-release-check-${process.pid}`)
  rmSync(site, { recursive: true, force: true })
  cpSync(join(theme, 'examples', 'full'), site, {
    recursive: true,
    filter: (path) =>
      !/[\/](?:dist|node_modules|\.astro|generated|pagefind)$/.test(path),
  })
  cpSync(out, join(site, 'theme'), { recursive: true })
  writeFileSync(
    join(site, 'astro.config.ts'),
    readFileSync(
      join(theme, 'examples', 'full', 'astro.config.ts'),
      'utf8',
    ).replace('../../src/', './theme/src/'),
  )
  writeFileSync(
    join(site, 'tsconfig.json'),
    JSON.stringify({
      extends: 'astro/tsconfigs/strict',
      compilerOptions: { paths: { '@/*': ['./src/*', './theme/src/*'] } },
      exclude: ['dist', 'src/generated'],
    }),
  )
  writeFileSync(
    join(site, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        astro: dependencies.astro,
        'website-theme': 'workspace:*',
      },
    }),
  )
  writeFileSync(
    join(site, 'pnpm-workspace.yaml'),
    readFileSync(join(theme, 'pnpm-workspace.yaml'), 'utf8').replace(
      /^/,
      'packages:\n  - theme\n\n',
    ),
  )
  const run = (...args) =>
    spawnSync('pnpm', args, {
      cwd: site,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }).status
  const failed = [
    ['install'],
    ['exec', 'astro', 'check'],
    ['exec', 'astro', 'build'],
  ].find((args) => run(...args) !== 0)
  const built = join(site, 'dist', '_astro')
  const mathFont =
    !failed &&
    existsSync(built) &&
    readdirSync(built).some((name) => /^STIXTwoMath.*.woff2$/.test(name))
  rmSync(site, { recursive: true, force: true })
  if (!failed && !mathFont) {
    console.error('The built example does not ship the bundled math font.')
    process.exit(1)
  }
  if (failed) {
    console.error(`pnpm ${failed.join(' ')} failed in the flattened site.`)
    process.exit(1)
  }
  console.log('The example installs, type-checks and builds as a consumer.')
}
