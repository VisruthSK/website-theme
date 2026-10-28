import {
  test as base,
  expect,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseTheme, type Theme } from '../config/theme.ts'
import { headersFor } from '../src/lib/local-headers.ts'

export type Mode = 'light' | 'dark'

export interface Site {
  name: SiteName
  dir: string
  port: number
  theme: Theme
  typeset: string[]
  footnotes: string
  citations?: string
  series?: string
  code?: string
  tag: string
  visual: string[]
}

const load = (dir: string) =>
  parseTheme(JSON.parse(readFileSync(`${dir}/theme.json`, 'utf8')))

export const SITES = {
  example: {
    name: 'example',
    dir: 'examples/full',
    port: 4321,
    theme: load('examples/full'),
    typeset: [
      '/essays/margins/',
      '/essays/rivers/',
      '/essays/bread/',
      '/essays/bread/starter/',
      '/essays/bread/baking/',
    ],
    footnotes: '/essays/margins/',
    citations: '/essays/rivers/',
    series: '/essays/bread/',
    code: '/notes/shell-loop/',
    tag: '/tags/lorem/',
    visual: [
      '/',
      '/essays/',
      '/essays/margins/',
      '/essays/rivers/',
      '/notes/shell-loop/',
      '/search/',
      '/404.html',
    ],
  },
  minimal: {
    name: 'minimal',
    dir: 'examples/minimal',
    port: 4322,
    theme: load('examples/minimal'),
    typeset: ['/journal/coastal-path/', '/journal/winter-light/'],
    footnotes: '/journal/winter-light/',
    tag: '/tags/lorem/',
    visual: ['/', '/journal/', '/journal/coastal-path/'],
  },
} satisfies Record<string, Omit<Site, 'name'> & { name: string }>

export type SiteName = keyof typeof SITES

export const baseOf = (site: Pick<Site, 'theme'>) =>
  new URL(site.theme.site.href).pathname.replace(/[/]$/, '')

const prefixed = (page: Page, site: Site) => {
  const goto = page.goto.bind(page)
  page.goto = (url, options) =>
    goto(
      url.startsWith('/') && !url.startsWith(`${baseOf(site)}/`)
        ? `${baseOf(site)}${url}`
        : url,
      options,
    )
  return page
}

export async function isolatedPage(
  browser: Browser,
  site: Site,
  options: BrowserContextOptions = {},
) {
  const context = await browser.newContext({
    ...options,
    baseURL: `http://127.0.0.1:${site.port}`,
  })
  return { context, page: prefixed(await context.newPage(), site) }
}

export const test = base.extend<{ site: Site }>({
  site: async ({}, use, testInfo) => {
    await use(SITES[testInfo.project.metadata.site as SiteName] as Site)
  },
  page: async ({ page, site }, use) => {
    await use(prefixed(page, site))
  },
})

export { expect }

export const headers = (site: Site) =>
  headersFor(new URL(`../${site.dir}/`, import.meta.url))

export async function enforceCsp(page: Page, site: Site) {
  const headersForPath = headers(site)
  await page.route('**/*', async (route) => {
    const request = route.request()
    if (request.resourceType() !== 'document') return route.continue()
    const policy = headersForPath(
      new URL(request.url()).pathname.slice(baseOf(site).length) || '/',
    )['Content-Security-Policy']
    if (!policy) return route.continue()
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': policy.replace(
          /;\s*upgrade-insecure-requests/,
          '',
        ),
      },
    })
  })
}

export async function visit(page: Page, site: Site, url: string, mode: Mode) {
  const errors: string[] = []
  await enforceCsp(page, site)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript((value: Mode) => {
    window.localStorage.setItem('theme', value)
  }, mode)

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
  await page.evaluate(async () => {
    await document.fonts.ready
    await (window as unknown as { __typesetReady?: Promise<void> })
      .__typesetReady
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })

  expect(errors, `Console errors on ${url} (${mode})`).toEqual([])
}

export const sectionHref = (site: Site) => `/${site.theme.sections[0].slug}/`
