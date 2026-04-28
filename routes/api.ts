import { response, route } from '@stacksjs/router'

/**
 * Car-rental API routes.
 *
 * Framework routes (auth, dashboard, etc.) load automatically from
 * storage/framework/defaults/routes/. useApi auto-CRUD endpoints (/api/cars,
 * /api/bookings, /api/locations, /api/reviews, etc.) are generated from
 * model definitions in app/Models/*. Only custom endpoints live here.
 */

route.get('/', () => response.text('car-rental api'))

// Health probes — useful for k8s liveness/readiness probes, ALB target
// groups, and uptime monitors. Public on purpose. /healthz is just "the
// process is alive"; /readyz also pings the DB so traffic only hits us
// once we're actually able to serve.
route.get('/healthz', () => response.json({ status: 'ok' }))
route.get('/readyz', async () => {
  try {
    const { db } = await import('@stacksjs/database')
    await db.selectFrom('users').select(['id']).limit(1).execute()
    return response.json({ status: 'ok', db: 'ok' })
  }
  catch (err) {
    return response.json({ status: 'degraded', db: (err as Error).message }, 503)
  }
})

// All API routes get a stamped X-Request-ID for log correlation. Mounted
// at the group level so /api/auth/login, the auto-CRUD endpoints, the
// custom actions all share the same id pipeline.
route.group({ prefix: '/api', middleware: ['request-id'] }, () => {
  route.get('/debug/globals', 'Actions/DebugGlobals')
  route.get('/search/cars', 'Actions/Search/CarSearchAction')
  route.get('/cars/by-slug/{key}', 'Actions/Cars/CarShowBySlugAction')
  route.get('/cars/{id}/availability', 'Actions/Cars/CheckAvailabilityAction')
  route.get('/cars/{id}/similar', 'Actions/Cars/SimilarCarsAction')

  // Relocations: driver-relocation marketplace (a.k.a. "drive-away" jobs)
  // Browsing is public; everything that mutates state goes through the
  // auth-gated group below.
  route.get('/relocations', 'Actions/Relocations/IndexAction')
  route.get('/relocations/{id}', 'Actions/Relocations/ShowAction')

  // Roadtrips: multi-leg journeys stitched together from open relocations.
  // The planner is public so users can preview chains before signing up;
  // owning/editing a trip is auth-gated below.
  route.get('/roadtrips/plan', 'Actions/Roadtrips/PlanAction')

  // Stripe Connect return URL — Stripe browser-redirects here without our
  // bearer token, so this MUST stay outside the `auth` group. The action
  // resolves the host via the `?acct=` query param it stamped onto the
  // return URL when generating the AccountLink.
  route.get('/host/connect/return', 'Actions/Host/ConnectReturnAction')

  route.group({ middleware: ['auth'] }, () => {
    route.get('/debug/me', 'Actions/DebugMe')
    // /api/me — superset of the framework's /me, includes host_profile so
    // the SPA can render host nav in one round-trip instead of two.
    route.get('/me', 'Actions/Auth/MeAction')
    route.get('/bookings/mine', 'Actions/Bookings/MyBookingsAction')
    route.post('/bookings', 'Actions/Bookings/BookingStoreAction')
    route.post('/bookings/{id}/cancel', 'Actions/Bookings/CancelBookingAction')

    route.post('/reviews', 'Actions/Reviews/ReviewStoreAction')

    route.post('/cars/{id}/photos', 'Actions/Cars/UploadPhotoAction')

    route.post('/favorites/{carId}', 'Actions/Favorites/AddAction')
    route.delete('/favorites/{carId}', 'Actions/Favorites/RemoveAction')
    route.get('/favorites', 'Actions/Favorites/IndexAction')

    route.post('/host/apply', 'Actions/Host/ApplyAction')
    route.get('/host/dashboard', 'Actions/Host/DashboardAction')
    route.post('/host/connect/onboard', 'Actions/Host/ConnectOnboardingAction')
    // host/connect/return registered above (outside auth group) — Stripe's
    // browser redirect doesn't carry our bearer token.

    route.post('/checkout/booking/{id}', 'Actions/Checkout/BookingCheckoutAction')
    route.post('/subscriptions/drivly-plus', 'Actions/Subscriptions/SubscribeAction')

    // Relocations — host-side
    route.get('/relocations/mine/host', 'Actions/Relocations/MyHostAction')
    route.post('/relocations', 'Actions/Relocations/StoreAction')
    route.post('/relocations/{id}/cancel', 'Actions/Relocations/CancelAction')
    route.post('/relocations/{id}/applications/{applicationId}/approve', 'Actions/Relocations/ApproveAction')
    route.post('/relocations/{id}/applications/{applicationId}/reject', 'Actions/Relocations/RejectAction')

    // Relocations — driver-side
    route.get('/relocations/mine/driver', 'Actions/Relocations/MyDriverAction')
    route.post('/relocations/{id}/apply', 'Actions/Relocations/ApplyAction')
    route.post('/relocations/{id}/start', 'Actions/Relocations/StartAction')
    route.post('/relocations/{id}/complete', 'Actions/Relocations/CompleteAction')

    // Roadtrips — owned by the planning user
    route.get('/roadtrips', 'Actions/Roadtrips/IndexAction')
    route.get('/roadtrips/{id}', 'Actions/Roadtrips/ShowAction')
    route.post('/roadtrips', 'Actions/Roadtrips/StoreAction')
    route.post('/roadtrips/{id}/cancel', 'Actions/Roadtrips/CancelAction')
    route.post('/roadtrips/{id}/legs', 'Actions/Roadtrips/AddLegAction')
    route.delete('/roadtrips/{id}/legs/{legId}', 'Actions/Roadtrips/RemoveLegAction')
    route.post('/roadtrips/{id}/apply', 'Actions/Roadtrips/ApplyAllAction')
  })

  route.post('/webhooks/stripe', 'Actions/Webhooks/StripeAction')
  route.post('/webhooks/stripe/connect', 'Actions/Webhooks/StripeConnectAction')

  // Auth endpoints are throttled per-IP. Login at 30/minute defangs
  // credential-stuffing without bothering a legitimate user re-typing a
  // password (~1 attempt/sec worst case). Register at 20/min throttles
  // signup-form abuse / disposable-email farming. The framework's
  // RateLimiter ALSO gates per-email lockout (see authentication.ts) so
  // a distributed attacker rotating IPs still hits the per-account wall.
  route.post('/auth/login', 'Actions/Auth/LoginAction').middleware('throttle:30,1')
  route.post('/auth/register', 'Actions/Auth/RegisterAction').middleware('throttle:20,1')
  route.post('/auth/logout', 'Actions/Auth/LogoutAction')
})
