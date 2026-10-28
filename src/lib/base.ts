const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export const withBase = (path: string) =>
  !path.startsWith('/') ||
  path.startsWith('//') ||
  path === BASE ||
  path.startsWith(`${BASE}/`)
    ? path
    : `${BASE}${path}`
