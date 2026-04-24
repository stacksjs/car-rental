import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { Middleware } from '@stacksjs/router'

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

export default new Middleware({
  name: 'Auth',
  priority: 1,
  async handle(request) {
    const { Auth } = await import('@stacksjs/auth')
    const bearerToken = extractBearerToken(request)

    if (bearerToken) {
      log.info(`[middleware:auth] bearer token extracted (${bearerToken.substring(0, 20)}...)`)
      const user = await Auth.getUserFromToken(bearerToken)
      if (!user) {
        log.info('[middleware:auth] invalid or expired token')
        throw new HttpError(401, 'Unauthorized. Invalid token.')
      }

      Auth.setUser(user)
      ;(request as any)._authenticatedUser = user
      log.info(`[middleware:auth] authenticated user ${user?._attributes?.id ?? user?.id}`)
      return
    }

    const sessionId = (typeof request.cookie === 'function') ? request.cookie('session_id') : undefined
    if (sessionId) {
      const { sessionCheck } = await import('@stacksjs/auth')
      const isValid = await sessionCheck(sessionId)
      if (!isValid)
        throw new HttpError(401, 'Unauthorized. Session expired.')
      return
    }

    throw new HttpError(401, 'Unauthorized. No token or session provided.')
  },
})
