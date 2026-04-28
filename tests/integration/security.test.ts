/**
 * Coverage for the security-hardening pass:
 *   - PII auto-CRUD endpoints removed (bookings/users index)
 *   - Health probes (/healthz, /readyz)
 *   - error envelope includes request_id
 *   - past-date booking rejection
 *   - Idempotency-Key replay protection
 *   - validation.rule enforcement on register
 *
 * Skips when the dev API isn't reachable.
 */

import { afterAll, beforeAll, describe, expect, test } from '@stacksjs/testing'

const API_BASE = process.env.E2E_API_BASE ?? 'http://127.0.0.1:3008'
const TEST_EMAIL = `sec-${Date.now()}@drivly.app`
const PW = 'sec-pw-1234'

let serverUp = false
let token: string | null = null
let createdBookingIds: number[] = []
let db: any

async function apiAvailable(): Promise<boolean> {
  try { return (await fetch(`${API_BASE}/v1/status`)).ok } catch { return false }
}

async function api(path: string, init: RequestInit = {}, tok?: string | null) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (tok) headers.authorization = `Bearer ${tok}`
  const r = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const text = await r.text()
  let body: any = text
  try { body = text ? JSON.parse(text) : null } catch { /* keep as text */ }
  return { status: r.status, body, headers: r.headers }
}

beforeAll(async () => {
  serverUp = await apiAvailable()
  if (!serverUp) {
    // eslint-disable-next-line no-console
    console.log(`[security.test] Skipping — ${API_BASE}/v1/status not reachable`)
    return
  }
  ;({ db } = await import('@stacksjs/database'))
  const r = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Sec Tester', email: TEST_EMAIL, password: PW }) })
  token = r.body?.token
})

afterAll(async () => {
  if (!db) return
  for (const id of createdBookingIds)
    await db.deleteFrom('bookings').where('id', '=', id).execute()
  await db.deleteFrom('idempotency_keys').where('user_id', '=', null).execute().catch(() => {})
  await db.deleteFrom('users').where('email', '=', TEST_EMAIL).execute()
})

describe('PII auto-CRUD endpoints removed', () => {
  test('GET /api/bookings (auto-CRUD index) is gone — no PII leak', async () => {
    if (!serverUp) return
    const r = await fetch(`${API_BASE}/api/bookings`)
    expect([404, 405]).toContain(r.status)
  })

  test('GET /api/users (auto-CRUD index) is gone', async () => {
    if (!serverUp) return
    const r = await fetch(`${API_BASE}/api/users`)
    expect([404, 405]).toContain(r.status)
  })

  test('GET /api/payment-methods (auto-CRUD index) is gone', async () => {
    if (!serverUp) return
    const r = await fetch(`${API_BASE}/api/payment-methods`)
    expect([404, 405]).toContain(r.status)
  })
})

describe('health probes', () => {
  test('/healthz returns 200 ok', async () => {
    if (!serverUp) return
    const r = await fetch(`${API_BASE}/healthz`)
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.status).toBe('ok')
  })

  test('/readyz returns 200 with db status when DB is reachable', async () => {
    if (!serverUp) return
    const r = await fetch(`${API_BASE}/readyz`)
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.db).toBe('ok')
  })
})

describe('observability headers', () => {
  test('every response carries Server-Timing total + X-Request-ID', async () => {
    if (!serverUp) return
    const r = await fetch(`${API_BASE}/api/cars?per_page=1`)
    expect(r.headers.get('server-timing')).toMatch(/total;dur=[\d.]+/)
    expect(r.headers.get('x-request-id')).toBeTruthy()
  })

  test('JSON error responses include request_id in the body', async () => {
    if (!serverUp) return
    // Intentionally bad payload triggers a validation 422 from the framework's
    // RegisterAction. The body should now carry request_id alongside the error.
    const r = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'x', email: 'not-an-email', password: 'short' }),
    })
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect(typeof r.body?.request_id).toBe('string')
    expect(r.body.request_id.length).toBeGreaterThan(8)
  })
})

describe('booking validation hardening', () => {
  test('start_date in the past is rejected', async () => {
    if (!serverUp || !token) return
    const r = await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        car_id: 1,
        start_date: '2020-01-01',
        end_date: '2020-01-05',
        protection_plan: 'standard',
        driver_first_name: 'X', driver_last_name: 'Y',
        driver_email: TEST_EMAIL, driver_phone: '555-0100',
        driver_dob: '1990-01-01', driver_license: 'X', driver_license_state: 'CA',
      }),
    }, token)
    expect(r.status).toBe(400)
    expect(String(r.body?.message ?? r.body?.error ?? '')).toMatch(/past/i)
  })

  test('end_date before start_date is rejected', async () => {
    if (!serverUp || !token) return
    const r = await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        car_id: 1,
        start_date: '2030-06-10',
        end_date: '2030-06-05',
        protection_plan: 'standard',
        driver_first_name: 'X', driver_last_name: 'Y',
        driver_email: TEST_EMAIL, driver_phone: '555-0100',
        driver_dob: '1990-01-01', driver_license: 'X', driver_license_state: 'CA',
      }),
    }, token)
    expect(r.status).toBe(400)
    expect(String(r.body?.message ?? r.body?.error ?? '')).toMatch(/end_date/i)
  })
})

describe('Idempotency-Key replay protection', () => {
  test('same key + same payload returns the cached response with X-Idempotency-Replay', async () => {
    if (!serverUp || !token) return
    const key = `idem-${Date.now()}`
    const payload = JSON.stringify({
      car_id: 1,
      start_date: '2030-08-01', end_date: '2030-08-05',
      protection_plan: 'standard',
      driver_first_name: 'IdemTest', driver_last_name: 'Tester',
      driver_email: TEST_EMAIL, driver_phone: '555-0100',
      driver_dob: '1990-01-01', driver_license: 'X', driver_license_state: 'CA',
    })

    const r1 = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': key },
      body: payload,
    })
    expect(r1.status).toBe(200)
    const b1 = await r1.json()
    expect(b1?.data?.id).toBeTruthy()
    createdBookingIds.push(b1.data.id)

    const r2 = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': key },
      body: payload,
    })
    expect(r2.status).toBe(200)
    expect(r2.headers.get('x-idempotency-replay')).toBe('true')
    const b2 = await r2.json()
    expect(b2?.data?.id).toBe(b1.data.id) // exact same booking, no second insert
  })
})

describe('validation rule enforcement', () => {
  test('register rejects malformed email at the validation layer', async () => {
    if (!serverUp) return
    const r = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', email: 'not-an-email', password: 'sufficient' }),
    })
    expect(r.status).toBe(422)
    expect(JSON.stringify(r.body)).toMatch(/email/i)
  })
})
