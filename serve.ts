/**
 * Project-level dev server.
 *
 * Wraps the default stx serve with a server-side auth gate so `/trips`,
 * `/favorites`, `/host/*` and the booking flow can't be reached via a
 * direct URL when there's no `drivly-token` cookie. The cookie is
 * mirrored from localStorage by `resources/stores/api.ts` after login.
 *
 * stx's page-level `definePageMeta({ middleware: ['auth'] })` only fires
 * during SPA navigation right now — initial requests come straight
 * through bun-plugin-stx, so we gate them here.
 */
import { projectPath } from '@stacksjs/path'

const PROTECTED_PREFIXES = ['/trips', '/favorites', '/host', '/book/', '/profile']

function needsAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p === '/host' ? `${p}/` : p))
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1))
  }
  return null
}

let serve: any
try {
  ;({ serve } = await import('bun-plugin-stx/serve'))
}
catch {
  ;({ serve } = await import(projectPath('pantry/bun-plugin-stx/dist/serve.js')))
}

await serve({
  patterns: ['resources/views', 'storage/framework/defaults/resources/views'],
  port: Number(process.env.PORT) || 3000,
  componentsDir: 'storage/framework/defaults/resources/components/Dashboard',
  layoutsDir: 'resources/layouts',
  partialsDir: 'resources/components',
  fallbackLayoutsDir: 'storage/framework/defaults/resources/layouts',
  fallbackPartialsDir: 'storage/framework/defaults/resources/views',
  quiet: true,
  onRequest(req: Request): Response | null | undefined {
    const url = new URL(req.url)
    if (!needsAuth(url.pathname)) return null

    const token = getCookie(req, 'drivly-token')
    if (token) return null

    const next = encodeURIComponent(url.pathname + url.search)
    return Response.redirect(`/login?next=${next}`, 302)
  },
})
