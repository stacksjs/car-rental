export default new Action({
  name: 'DebugMe',
  description: 'Diagnostic for bearer token + user resolution',
  method: 'GET',

  async handle(request: RequestInstance) {
    const r: any = request
    const headers: Record<string, string> = {}
    if (r.headers?.forEach) r.headers.forEach((v: string, k: string) => headers[k] = v)

    let bearerFromMethod: string | null = null
    let bearerFromMethodError: string | null = null
    try {
      bearerFromMethod = typeof r.bearerToken === 'function' ? r.bearerToken() : null
    }
    catch (e) { bearerFromMethodError = String(e) }

    const authHeader = r.headers?.get?.('authorization') || r.headers?.get?.('Authorization') || null

    let userFromToken: any = null
    let userError: string | null = null
    try {
      const { Auth } = await import('@stacksjs/auth')
      const token = bearerFromMethod || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null)
      if (token) {
        const u = await Auth.getUserFromToken(token)
        userFromToken = {
          hasUser: !!u,
          type: typeof u,
          keys: u ? Object.getOwnPropertyNames(u) : null,
          id_direct: u?.id ?? null,
          id_attributes: u?._attributes?.id ?? null,
          rawAttributes: u?._attributes ?? null,
        }
      }
    }
    catch (e) { userError = String(e) }

    return response.json({
      request_type: typeof r,
      has_bearerToken_method: typeof r.bearerToken === 'function',
      bearerFromMethod,
      bearerFromMethodError,
      authHeader_prefix: authHeader ? authHeader.substring(0, 20) : null,
      request_user_type: typeof r.user,
      request_authenticated_user_set: !!r._authenticatedUser,
      userFromToken,
      userError,
    })
  },
})
