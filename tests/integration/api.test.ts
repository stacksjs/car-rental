/**
 * E2E tests against the live API server (`./buddy dev --api`).
 *
 * Skips automatically when the server isn't reachable so that `bun test`
 * stays useful even without dev mode running. To exercise these:
 *
 *   ./buddy dev --api  # in one terminal
 *   bun test tests/integration/api.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from '@stacksjs/testing'

const API_BASE = process.env.E2E_API_BASE ?? 'http://127.0.0.1:3008'
const TEST_EMAIL = `e2e-${Date.now()}@drivly.app`
const TEST_PASSWORD = 'e2e-pass-1234'

let serverUp = false
let token: string | null = null
let createdBookingId: number | null = null
let db: any

async function apiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/v1/status`)
    return r.ok
  }
  catch { return false }
}

async function api(path: string, init: RequestInit = {}): Promise<{ status: number, body: any }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (token) headers.authorization = `Bearer ${token}`
  const r = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const text = await r.text()
  let body: any = text
  try { body = text ? JSON.parse(text) : null } catch { /* keep as text */ }
  return { status: r.status, body }
}

beforeAll(async () => {
  serverUp = await apiAvailable()
  if (!serverUp) {
    // eslint-disable-next-line no-console
    console.log(`[api.test] Skipping — ${API_BASE}/v1/status not reachable`)
    return
  }
  ;({ db } = await import('@stacksjs/database'))
})

afterAll(async () => {
  if (createdBookingId)
    await db?.deleteFrom('bookings').where('id', '=', createdBookingId).execute()
  if (db) {
    await db.deleteFrom('users').where('email', '=', TEST_EMAIL).execute()
  }
})

describe('API e2e', () => {
  test('GET / returns the api banner', async () => {
    if (!serverUp) return
    const r = await fetch(`${API_BASE}/`)
    expect(await r.text()).toBe('car-rental api')
  })

  test('GET /v1/status responds with a version envelope', async () => {
    if (!serverUp) return
    const { status, body } = await api('/v1/status')
    expect(status).toBe(200)
    expect(body?.version).toBe('v1')
    expect(body?.status).toBe('ok')
  })

  test('GET /api/search/cars returns paginated cars', async () => {
    if (!serverUp) return
    const { status, body } = await api('/api/search/cars?limit=3')
    expect(status).toBe(200)
    expect(Array.isArray(body?.data)).toBe(true)
    expect(body.data.length).toBeLessThanOrEqual(3)
    expect(body.meta).toBeTruthy()
    expect(typeof body.meta.total).toBe('number')
  })

  test('GET /api/cars (auto-CRUD) ignores reserved query params instead of crashing', async () => {
    if (!serverUp) return
    // Before the routes.ts fix, ?limit=N tried to emit `WHERE limit = N`
    // and SQLite blew up because LIMIT is a keyword.
    const { status, body } = await api('/api/cars?limit=1&bogus_col=evil&per_page=1')
    expect(status).toBe(200)
    expect(Array.isArray(body?.data)).toBe(true)
    expect(body?.error).toBeUndefined()
  })

  test('GET /api/cars (auto-CRUD) returns model-cast values, not raw SQLite text', async () => {
    if (!serverUp) return
    const { status, body } = await api('/api/cars?per_page=1')
    expect(status).toBe(200)
    const car = body?.data?.[0]
    expect(car).toBeTruthy()
    // Casts declared on Car model must apply through the auto-CRUD path,
    // not just the model-driven path.
    expect(typeof car.instant_book).toBe('boolean')
    expect(typeof car.daily_rate).toBe('number')
    expect(typeof car.rating).toBe('number')
  })

  test('PATCH /api/cars/{id} applies set-side casts (parity with model.create)', async () => {
    if (!serverUp) return
    // Need any authed user — the e2e tester registered earlier in the suite
    // works; this test runs after it.
    if (!token) return
    const before = await api('/api/cars/1')
    const beforeRate = before.body.data.daily_rate
    const beforeInstant = before.body.data.instant_book

    // Send the boolean as a JS true and the rate as a string — both
    // shapes a real SPA might submit. Casts must coerce them.
    const patched = await api('/api/cars/1', {
      method: 'PATCH',
      body: JSON.stringify({ instant_book: true, daily_rate: '299' }),
    })
    expect(patched.status).toBe(200)
    expect(typeof patched.body.data.instant_book).toBe('boolean')
    expect(typeof patched.body.data.daily_rate).toBe('number')
    expect(patched.body.data.daily_rate).toBe(299)

    // Restore so the dev DB stays as the seeder left it.
    await api('/api/cars/1', {
      method: 'PATCH',
      body: JSON.stringify({ daily_rate: beforeRate, instant_book: beforeInstant }),
    })
  })

  test('GET /api/host/connect/return is publicly reachable (Stripe redirects strip auth)', async () => {
    if (!serverUp) return
    // No bearer token, no acct param — should redirect to /host/dashboard,
    // not return 401. Status 302 is the success signal here.
    const r = await fetch(`${API_BASE}/api/host/connect/return`, { redirect: 'manual' })
    expect(r.status).toBe(302)
    expect(r.headers.get('location') ?? '').toMatch(/host\/dashboard/)
  })

  test('GET /api/cars/by-slug strips hidden fields (license_plate, vin)', async () => {
    if (!serverUp) return
    // Use whichever slug exists — pick the first one from the search.
    const list = await api('/api/search/cars?limit=1')
    const slug = list.body?.data?.[0]?.slug
    expect(slug).toBeTruthy()

    const { status, body } = await api(`/api/cars/by-slug/${slug}`)
    expect(status).toBe(200)
    expect(body.data).toBeTruthy()
    // Hidden fields must not leak to public consumers.
    expect('license_plate' in body.data).toBe(false)
    expect('vin' in body.data).toBe(false)
    // But useful ones are present.
    expect(body.data.id).toBeDefined()
    expect(body.data.slug).toBe(slug)
  })

  test('GET /api/cars/{id}/availability returns busy windows', async () => {
    if (!serverUp) return
    const list = await api('/api/search/cars?limit=1')
    const id = list.body?.data?.[0]?.id
    const { status, body } = await api(`/api/cars/${id}/availability`)
    expect(status).toBe(200)
    expect(body.carId).toBe(id)
    expect(Array.isArray(body.busy)).toBe(true)
    expect(typeof body.isAvailable).toBe('boolean')
  })

  test('POST /api/auth/register issues a token', async () => {
    if (!serverUp) return
    const { status, body } = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'E2E Tester', email: TEST_EMAIL, password: TEST_PASSWORD }),
    })
    expect(status).toBe(200)
    expect(typeof body.token).toBe('string')
    token = body.token
  })

  test('POST /api/auth/login returns a token for the freshly-registered user', async () => {
    if (!serverUp) return
    const { status, body } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    })
    expect(status).toBe(200)
    expect(typeof body.token).toBe('string')
    expect(body.user?.email).toBe(TEST_EMAIL)
    token = body.token
  })

  test('POST /api/bookings creates a booking with computed totals', async () => {
    if (!serverUp || !token) return
    const list = await api('/api/search/cars?limit=1')
    const carId = list.body?.data?.[0]?.id
    expect(carId).toBeDefined()

    const { status, body } = await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        car_id: carId,
        start_date: '2030-06-01',
        end_date: '2030-06-05',
        protection_plan: 'standard',
        driver_first_name: 'E2E',
        driver_last_name: 'Tester',
        driver_email: TEST_EMAIL,
        driver_phone: '555-0123',
        driver_dob: '1990-01-01',
        driver_license: 'L123456',
        driver_license_state: 'CA',
      }),
    })
    expect(status).toBe(200)
    expect(body.data.id).toBeDefined()
    expect(body.data.status).toBe('pending')
    expect(body.data.subtotal).toBeGreaterThan(0)
    expect(body.data.total).toBe(body.data.subtotal + body.data.protection_fee + body.data.extras_fee + body.data.taxes)
    expect(body.data.platform_fee + body.data.payout_amount).toBe(body.data.total)
    createdBookingId = body.data.id
  })

  test('POST /api/bookings rejects overlapping dates for the same car', async () => {
    if (!serverUp || !token || !createdBookingId) return
    const list = await api('/api/search/cars?limit=1')
    const carId = list.body?.data?.[0]?.id

    const { status, body } = await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        car_id: carId,
        start_date: '2030-06-03', // overlaps the booking from the previous test
        end_date: '2030-06-07',
        protection_plan: 'minimum',
        driver_first_name: 'E2E', driver_last_name: 'Tester',
        driver_email: TEST_EMAIL, driver_phone: '555-0123', driver_dob: '1990-01-01',
        driver_license: 'L123456', driver_license_state: 'CA',
      }),
    })
    expect(status).toBe(400)
    expect(String(body?.message ?? body?.error ?? '')).toMatch(/not available/i)
  })

  test('GET /api/bookings/mine lists the booking under "upcoming"', async () => {
    if (!serverUp || !token || !createdBookingId) return
    const { status, body } = await api('/api/bookings/mine')
    expect(status).toBe(200)
    expect(Array.isArray(body.upcoming)).toBe(true)
    const ids = body.upcoming.map((b: any) => b.id)
    expect(ids).toContain(createdBookingId)
  })

  test('POST /api/bookings/{id}/cancel flips status to cancelled', async () => {
    if (!serverUp || !token || !createdBookingId) return
    const { status, body } = await api(`/api/bookings/${createdBookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'e2e cleanup' }),
    })
    expect(status).toBe(200)
    expect(body.data.status).toBe('cancelled')
    expect(body.data.cancellation_reason).toBe('e2e cleanup')
  })

  test('POST /api/host/apply creates a HostProfile with seeded defaults', async () => {
    if (!serverUp || !token) return
    const { status, body } = await api('/api/host/apply', {
      method: 'POST',
      body: JSON.stringify({ bio: 'e2e host bio' }),
    })
    expect(status).toBe(200)
    expect(body.data.user_id).toBeDefined()
    // Counters must persist (not be NULL) thanks to the bypass-fillable insert.
    expect(body.data.trips).toBe(0)
    expect(body.data.rating).toBe(5)
    expect(body.data.platform_fee_bps).toBe(1500)
    expect(body.data.charges_enabled).toBeFalsy()
  })

  test('GET /api/host/dashboard returns kpis once the user is a host', async () => {
    if (!serverUp || !token) return
    const { status, body } = await api('/api/host/dashboard')
    expect(status).toBe(200)
    expect(body.kpis).toBeTruthy()
    expect(typeof body.kpis.totalEarnings).toBe('number')
    expect(typeof body.chargesEnabled).toBe('boolean')
    expect(body.chargesEnabled).toBe(false)
  })
})
