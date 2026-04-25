/**
 * Helpers for reading the authed user + its id out of an enhanced Request.
 *
 * The bun-router enhanced `request.user` is an async callable that depends on
 * the Auth singleton having been primed, and it sometimes returns null even
 * after the middleware ran. To be bullet-proof, this helper re-derives the
 * user directly from the bearer token.
 */
import { Auth } from '@stacksjs/auth'

function extractBearerToken(request: any): string | null {
  const tryVal = (v: any): string | null => typeof v === 'string' && v.startsWith('Bearer ') ? v.substring(7) : null
  if (typeof request?.bearerToken === 'function') {
    const t = request.bearerToken()
    if (t) return t
  }
  if (typeof request?.header === 'function') {
    const h = tryVal(request.header('authorization')) || tryVal(request.header('Authorization'))
    if (h) return h
  }
  if (request?.headers?.get) {
    const h = tryVal(request.headers.get('authorization')) || tryVal(request.headers.get('Authorization'))
    if (h) return h
  }
  return null
}

export async function resolveAuthedUser(request: any): Promise<any | null> {
  if (request?._authenticatedUser)
    return request._authenticatedUser

  const token = extractBearerToken(request)
  if (token) {
    try {
      const user = await Auth.getUserFromToken(token)
      if (user) {
        request._authenticatedUser = user
        return user
      }
    }
    catch { /* ignore */ }
  }

  if (typeof request?.user === 'function') {
    try {
      const u = await request.user()
      if (u) return u
    }
    catch { /* ignore */ }
  }

  return null
}

export function userIdFrom(user: any): number | null {
  if (!user) return null
  const raw = user._attributes?.id ?? user.attributes?.id ?? user.id
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function authedUserId(request: any): Promise<number | null> {
  return userIdFrom(await resolveAuthedUser(request))
}
