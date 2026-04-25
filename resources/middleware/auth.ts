import { defineMiddleware } from 'stx'

/**
 * Gate `/trips`, `/favorites`, `/host/*`, `/book/*` and the rest of the
 * authed surface. Runs both server-side (cookie-based) on the initial
 * request and client-side (localStorage) on SPA navigations.
 */
export default defineMiddleware('auth', (ctx) => {
  const next = encodeURIComponent(ctx.to?.path ?? '/')
  const loginUrl = `/login?next=${next}`

  if (ctx.isServer) {
    const token = ctx.cookies?.get?.('drivly-token')
    if (!token) return ctx.redirect(loginUrl)
    return
  }

  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('drivly-token') : null
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('drivly-session') : null
    const session = raw ? JSON.parse(raw) : null
    if (!token || !session?.user) return ctx.redirect(loginUrl)
  }
  catch {
    return ctx.redirect(loginUrl)
  }
})
