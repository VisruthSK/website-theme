import { BROWSER_COLORS, SITE } from '@/consts'
import { withBase } from '@/lib/base'

export const prerender = true

export async function GET() {
  const manifest = {
    name: SITE.title,
    short_name: SITE.title,
    description: SITE.description,
    start_url: withBase('/'),
    scope: withBase('/'),
    display: 'minimal-ui',
    background_color: BROWSER_COLORS.light,
    theme_color: BROWSER_COLORS.dark,
    lang: SITE.locale,
    icons: [],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
