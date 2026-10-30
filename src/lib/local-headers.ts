import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Header = readonly [name: string, value: string | null]

function parseHeader(line: string): Header {
  if (line.startsWith('!')) return [line.slice(1).trim(), null]
  const separator = line.indexOf(':')
  if (separator === -1) {
    throw new Error(`Invalid header line in public/_headers: ${line}`)
  }
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
}

const parseRules = (root: URL) =>
  readFileSync(new URL('public/_headers', root), 'utf8')
    .split(/\r?\n\r?\n+/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0)
    .map(([pattern, ...lines]) => ({
      matches: new RegExp(
        `^${pattern.split('*').map(RegExp.escape).join('.*')}$`,
      ),
      headers: lines.map(parseHeader),
    }))

export function headersFor(root: URL) {
  const rules = parseRules(root)
  return (pathname: string) => {
    const headers: Record<string, string> = {}
    for (const rule of rules.filter(({ matches }) => matches.test(pathname))) {
      for (const [name, value] of rule.headers) {
        if (value === null) delete headers[name]
        else headers[name] = value
      }
    }
    return headers
  }
}

type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void

type Server = { middlewares: { use: (handler: Middleware) => void } }

export function localHeadersPlugin(root: URL) {
  const headersForPath = headersFor(root)
  const useLocalHeaders = (server: Server) =>
    server.middlewares.use((req, res, next) => {
      const { pathname } = new URL(req.url ?? '/', 'http://localhost')
      for (const [name, value] of Object.entries(headersForPath(pathname))) {
        res.setHeader(name, value)
      }
      next()
    })

  return {
    name: 'local-headers',
    configureServer: useLocalHeaders,
    configurePreviewServer: useLocalHeaders,
  }
}
