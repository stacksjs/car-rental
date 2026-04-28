/**
 * Request-ID middleware.
 *
 * Stamps an `X-Request-ID` on every response so logs and bug reports can
 * be correlated. Honors an inbound `X-Request-ID` (e.g. from a load
 * balancer or upstream tracer) when present and matches a sane shape;
 * otherwise generates a fresh UUID.
 *
 * The id is also attached to the request object so action handlers + the
 * @stacksjs/logging facade can include it in their structured output.
 */

import { Middleware } from '@stacksjs/router'

const SAFE_REQUEST_ID = /^[a-zA-Z0-9._-]{8,128}$/

export default new Middleware({
  name: 'RequestId',
  // Run early so downstream middleware can log against the id.
  priority: 0,
  async handle(request) {
    const inbound = request?.headers?.get?.('x-request-id') || request?.headers?.get?.('X-Request-ID') || ''
    const id = (typeof inbound === 'string' && SAFE_REQUEST_ID.test(inbound))
      ? inbound
      : crypto.randomUUID()

    ;(request as any)._requestId = id
    // Stash on response.headers if the framework's response helper exposes it.
    if (typeof (request as any).setResponseHeader === 'function')
      (request as any).setResponseHeader('X-Request-ID', id)
  },
})
