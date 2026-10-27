import { SITE } from '@/consts'

export const prerender = true

export async function GET() {
  const manifest = {
    name: SITE.title,
    short_name: SITE.title,
    description: SITE.description,
    start_url: '/',
    scope: '/',
    display: 'minimal-ui',
    background_color: SITE.manifest.background,
    theme_color: SITE.manifest.theme,
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
