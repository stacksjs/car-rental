/**
 * Auto-CRUD framework features: ownership enforcement, pagination opt-ins,
 * X-Total-Count header. Soft-delete is exercised separately because none
 * of the car-rental models currently opt into the trait — wiring it up
 * here against an arbitrary model would couple the test to fixture state.
 */

import { afterAll, beforeAll, describe, expect, test } from '@stacksjs/testing'

const API_BASE = process.env.E2E_API_BASE ?? 'http://127.0.0.1:3008'

let serverUp = false
let outsiderToken: string | null = null
let ownerToken: string | null = null
let testCarId: number | null = null
let originalHostProfileId: number | null = null
const OUTSIDER_EMAIL = `acl-outsider-${Date.now()}@drivly.app`
const OWNER_EMAIL = `acl-owner-${Date.now()}@drivly.app`
const PW = 'acl-pw-1234'
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
    console.log(`[auto-crud.test] Skipping — ${API_BASE}/v1/status not reachable`)
    return
  }
  ;({ db } = await import('@stacksjs/database'))

  // Outsider: a regular guest who must NOT be able to PATCH our test car.
  const o = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Outsider', email: OUTSIDER_EMAIL, password: PW }) })
  outsiderToken = o.body?.token

  // Owner: a host who DOES own the test car.
  const ow = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Owner', email: OWNER_EMAIL, password: PW }) })
  ownerToken = ow.body?.token
  await api('/api/host/apply', { method: 'POST', body: '{}' }, ownerToken)

  // Re-parent a car onto the owner's host_profile so the ownership check
  // passes for them and fails for the outsider.
  const ownerUser = await db.selectFrom('users').select(['id']).where('email', '=', OWNER_EMAIL).executeTakeFirst()
  const ownerHp = await db.selectFrom('host_profiles').select(['id']).where('user_id', '=', ownerUser.id).executeTakeFirst()
  const car = await db.selectFrom('cars').select(['id', 'host_profile_id']).orderBy('id', 'asc').executeTakeFirst()
  testCarId = Number(car.id)
  originalHostProfileId = car.host_profile_id == null ? null : Number(car.host_profile_id)
  await db.updateTable('cars').set({ host_profile_id: ownerHp.id }).where('id', '=', testCarId).execute()
})

afterAll(async () => {
  if (!db) return
  if (testCarId)
    await db.updateTable('cars').set({ host_profile_id: originalHostProfileId }).where('id', '=', testCarId).execute()
  for (const email of [OUTSIDER_EMAIL, OWNER_EMAIL])
    await db.deleteFrom('users').where('email', '=', email).execute()
})

describe('auto-CRUD ownership enforcement', () => {
  test('outsider cannot PATCH a car they don\'t own', async () => {
    if (!serverUp || !outsiderToken || !testCarId) return
    const { status, body } = await api(`/api/cars/${testCarId}`, {
      method: 'PATCH',
      body: JSON.stringify({ daily_rate: 999 }),
    }, outsiderToken)
    expect(status).toBe(403)
    expect(String(body?.error ?? '')).toMatch(/not your/i)
  })

  test('owner CAN PATCH their own car', async () => {
    if (!serverUp || !ownerToken || !testCarId) return
    const before = await api(`/api/cars/${testCarId}`)
    const beforeRate = before.body.data.daily_rate

    const patched = await api(`/api/cars/${testCarId}`, {
      method: 'PATCH',
      body: JSON.stringify({ daily_rate: 511 }),
    }, ownerToken)
    expect(patched.status).toBe(200)
    expect(patched.body.data.daily_rate).toBe(511)

    // Restore so the dev fixture stays predictable.
    await api(`/api/cars/${testCarId}`, {
      method: 'PATCH',
      body: JSON.stringify({ daily_rate: beforeRate }),
    }, ownerToken)
  })

  test('outsider cannot DELETE a car they don\'t own', async () => {
    if (!serverUp || !outsiderToken || !testCarId) return
    const { status, body } = await api(`/api/cars/${testCarId}`, { method: 'DELETE' }, outsiderToken)
    expect(status).toBe(403)
    expect(String(body?.error ?? '')).toMatch(/not your/i)
  })

  test('PATCH cannot reassign ownership to another host_profile_id', async () => {
    if (!serverUp || !ownerToken || !testCarId) return
    const { status, body } = await api(`/api/cars/${testCarId}`, {
      method: 'PATCH',
      body: JSON.stringify({ host_profile_id: 999_999 }),
    }, ownerToken)
    expect(status).toBe(403)
    expect(String(body?.error ?? '')).toMatch(/reassign/i)
  })
})

describe('auto-CRUD pagination opt-ins', () => {
  test('default response omits total/last_page (saves a COUNT(*) query)', async () => {
    if (!serverUp) return
    const { status, body, headers } = await api('/api/cars?per_page=2')
    expect(status).toBe(200)
    expect(body.meta.page).toBe(1)
    expect(body.meta.per_page).toBe(2)
    expect('total' in body.meta).toBe(false)
    expect('last_page' in body.meta).toBe(false)
    expect(headers.get('x-total-count')).toBeNull()
  })

  test('?with_count=true includes total + last_page + X-Total-Count header', async () => {
    if (!serverUp) return
    const { status, body, headers } = await api('/api/cars?per_page=2&with_count=true')
    expect(status).toBe(200)
    expect(typeof body.meta.total).toBe('number')
    expect(body.meta.last_page).toBeGreaterThanOrEqual(1)
    expect(headers.get('x-total-count')).toBe(String(body.meta.total))
  })
})

describe('host_profile race-fix', () => {
  test('concurrent /api/host/apply requests don\'t create duplicates', async () => {
    if (!serverUp || !ownerToken) return
    // Fire two POSTs in parallel — one wins the INSERT, the other catches
    // the UNIQUE constraint and returns the winner's row.
    const [a, b] = await Promise.all([
      api('/api/host/apply', { method: 'POST', body: '{}' }, ownerToken),
      api('/api/host/apply', { method: 'POST', body: '{}' }, ownerToken),
    ])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(a.body.data.id).toBe(b.body.data.id)

    // DB invariant: exactly one host_profile per (user_id IS NOT NULL).
    const ownerUser = await db.selectFrom('users').select(['id']).where('email', '=', OWNER_EMAIL).executeTakeFirst()
    const rows = await db.selectFrom('host_profiles').select(['id']).where('user_id', '=', ownerUser.id).execute()
    expect(rows.length).toBe(1)
  })
})
