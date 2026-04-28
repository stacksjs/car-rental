/**
 * E2E tests for the relocation marketplace against the live `./buddy dev --api`
 * server. Two-actor flow: a host posts a relocation, a freshly-registered
 * driver applies, the host approves, the driver starts + completes the trip,
 * and we verify the computed payout.
 *
 * Skips automatically when the server isn't reachable.
 */

import { afterAll, beforeAll, describe, expect, test } from '@stacksjs/testing'

const API_BASE = process.env.E2E_API_BASE ?? 'http://127.0.0.1:3008'
const HOST_EMAIL = `reloc-host-${Date.now()}@drivly.app`
const DRIVER_EMAIL = `reloc-driver-${Date.now()}@drivly.app`
const PW = 'reloc-pw-1234'

let serverUp = false
let hostToken: string | null = null
let driverToken: string | null = null
let relocId: number | null = null
let appId: number | null = null
let testCarId: number | null = null
let originalCarHostProfileId: number | null = null
let db: any

async function apiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/v1/status`)
    return r.ok
  }
  catch { return false }
}

async function api(path: string, init: RequestInit = {}, tok?: string | null): Promise<{ status: number, body: any }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (tok) headers.authorization = `Bearer ${tok}`
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
    console.log(`[relocations.test] Skipping — ${API_BASE}/v1/status not reachable`)
    return
  }
  ;({ db } = await import('@stacksjs/database'))
})

afterAll(async () => {
  if (!db) return
  if (relocId) await db.deleteFrom('relocations').where('id', '=', relocId).execute()
  if (appId) await db.deleteFrom('relocation_applications').where('id', '=', appId).execute()
  // Restore the original host_profile_id on the car we re-parented.
  if (testCarId)
    await db.updateTable('cars').set({ host_profile_id: originalCarHostProfileId }).where('id', '=', testCarId).execute()
  for (const email of [HOST_EMAIL, DRIVER_EMAIL])
    await db.deleteFrom('users').where('email', '=', email).execute()
})

describe('Relocations e2e', () => {
  test('host registers, applies as host, gets a host_profile_id', async () => {
    if (!serverUp) return
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Reloc Host', email: HOST_EMAIL, password: PW }),
    })
    expect(reg.status).toBe(200)
    hostToken = reg.body.token
    expect(typeof hostToken).toBe('string')

    const apply = await api('/api/host/apply', { method: 'POST', body: '{}' }, hostToken)
    expect(apply.status).toBe(200)
    expect(apply.body.data.user_id).toBeDefined()

    // Re-parent an existing car so the ownership check passes. We restore
    // it in afterAll() to keep the dev DB tidy for the next run.
    const userRow = await db.selectFrom('users').select(['id']).where('email', '=', HOST_EMAIL).executeTakeFirst()
    const hpRow = await db.selectFrom('host_profiles').select(['id']).where('user_id', '=', userRow.id).executeTakeFirst()
    const carRow = await db.selectFrom('cars').select(['id', 'host_profile_id']).orderBy('id', 'asc').executeTakeFirst()
    testCarId = Number(carRow.id)
    originalCarHostProfileId = carRow.host_profile_id == null ? null : Number(carRow.host_profile_id)
    await db.updateTable('cars').set({ host_profile_id: hpRow.id }).where('id', '=', testCarId).execute()
  })

  test('host posts a relocation', async () => {
    if (!serverUp || !hostToken || !testCarId) return
    const { status, body } = await api('/api/relocations', {
      method: 'POST',
      body: JSON.stringify({
        car_id: testCarId,
        pickup_address: 'Avis SFO, 780 N McDonnell Rd',
        dropoff_address: 'Avis LAX, 9020 Aviation Blvd',
        earliest_pickup_date: '2030-04-01',
        latest_dropoff_date: '2030-04-04',
        estimated_distance_miles: 380,
        compensation_type: 'flat',
        flat_fee: 200,
        fuel_allowance: 60,
        max_extra_days: 1,
        notes: 'e2e relocation test',
      }),
    }, hostToken)
    expect(status).toBe(200)
    expect(body.data.status).toBe('open')
    expect(body.data.flat_fee).toBe(200)
    expect(typeof body.data.license_required).toBe('boolean')
    relocId = body.data.id
  })

  test('public GET /api/relocations lists the new posting', async () => {
    if (!serverUp || !relocId) return
    const { status, body } = await api(`/api/relocations?limit=50`)
    expect(status).toBe(200)
    const ids = (body.data || []).map((r: any) => r.id)
    expect(ids).toContain(relocId)
  })

  test('rejects compensation_type without matching numeric input', async () => {
    if (!serverUp || !hostToken || !testCarId) return
    const { status } = await api('/api/relocations', {
      method: 'POST',
      body: JSON.stringify({
        car_id: testCarId,
        pickup_address: 'A', dropoff_address: 'B',
        earliest_pickup_date: '2030-04-10', latest_dropoff_date: '2030-04-12',
        compensation_type: 'flat', flat_fee: 0,
      }),
    }, hostToken)
    expect(status).toBe(400)
  })

  test('driver registers + applies + sees pending status', async () => {
    if (!serverUp || !relocId) return
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Reloc Driver', email: DRIVER_EMAIL, password: PW }),
    })
    expect(reg.status).toBe(200)
    driverToken = reg.body.token

    const applyRes = await api(`/api/relocations/${relocId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ message: 'Free this weekend' }),
    }, driverToken)
    expect(applyRes.status).toBe(200)
    expect(applyRes.body.data.status).toBe('pending')
    appId = applyRes.body.data.id

    // Driver's "mine" view should show the application as pending.
    const mine = await api('/api/relocations/mine/driver', {}, driverToken)
    expect(mine.status).toBe(200)
    const myAppIds = (mine.body.applications || []).map((a: any) => a.id)
    expect(myAppIds).toContain(appId)
  })

  test('host cannot apply to their own relocation', async () => {
    if (!serverUp || !relocId || !hostToken) return
    const { status, body } = await api(`/api/relocations/${relocId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ message: 'self-apply' }),
    }, hostToken)
    expect(status).toBe(400)
    expect(String(body?.message ?? body?.error ?? '')).toMatch(/own/i)
  })

  test('host approves the application — relocation flips to claimed', async () => {
    if (!serverUp || !relocId || !appId || !hostToken) return
    const { status, body } = await api(
      `/api/relocations/${relocId}/applications/${appId}/approve`,
      { method: 'POST', body: '{}' },
      hostToken,
    )
    expect(status).toBe(200)
    expect(body.data.relocation.status).toBe('claimed')
    expect(body.data.application.status).toBe('approved')
    expect(Number(body.data.relocation.driver_id)).toBeGreaterThan(0)
  })

  test('driver starts the trip with start_odometer', async () => {
    if (!serverUp || !relocId || !driverToken) return
    const { status, body } = await api(`/api/relocations/${relocId}/start`, {
      method: 'POST',
      body: JSON.stringify({ start_odometer: 50000 }),
    }, driverToken)
    expect(status).toBe(200)
    expect(body.data.status).toBe('in_progress')
    expect(body.data.start_odometer).toBe(50000)
    expect(body.data.started_at).toBeTruthy()
  })

  test('driver completes the trip — payout = flat_fee + fuel_allowance', async () => {
    if (!serverUp || !relocId || !driverToken) return
    const { status, body } = await api(`/api/relocations/${relocId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ end_odometer: 50425 }),
    }, driverToken)
    expect(status).toBe(200)
    expect(body.data.status).toBe('completed')
    expect(body.data.actual_miles_driven).toBe(425)
    // flat 200 + fuel 60 = 260
    expect(body.data.payout_amount).toBe(260)
    expect(body.data.completed_at).toBeTruthy()
  })

  test('cannot start a relocation that is already completed', async () => {
    if (!serverUp || !relocId || !driverToken) return
    const { status } = await api(`/api/relocations/${relocId}/start`, {
      method: 'POST',
      body: JSON.stringify({ start_odometer: 60000 }),
    }, driverToken)
    expect(status).toBe(400)
  })

  test('host can cancel a fresh, open posting and dangling apps go to rejected', async () => {
    if (!serverUp || !hostToken || !testCarId) return
    // Spin up a brand-new posting, apply, then cancel.
    const create = await api('/api/relocations', {
      method: 'POST',
      body: JSON.stringify({
        car_id: testCarId,
        pickup_address: 'X', dropoff_address: 'Y',
        earliest_pickup_date: '2030-05-01', latest_dropoff_date: '2030-05-04',
        compensation_type: 'per_mile', per_mile_rate: 0.5, fuel_allowance: 30,
      }),
    }, hostToken)
    expect(create.status).toBe(200)
    const cancelRelocId = create.body.data.id

    const apply = await api(`/api/relocations/${cancelRelocId}/apply`, {
      method: 'POST', body: JSON.stringify({ message: 'pls' }),
    }, driverToken)
    expect(apply.status).toBe(200)
    const cancelAppId = apply.body.data.id

    const cancel = await api(`/api/relocations/${cancelRelocId}/cancel`, {
      method: 'POST', body: '{}',
    }, hostToken)
    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('cancelled')

    // The pending application should now be rejected.
    const mine = await api('/api/relocations/mine/driver', {}, driverToken)
    const matching = (mine.body.applications || []).find((a: any) => a.id === cancelAppId)
    expect(matching?.status).toBe('rejected')

    // Cleanup these helper rows.
    await db.deleteFrom('relocation_applications').where('id', '=', cancelAppId).execute()
    await db.deleteFrom('relocations').where('id', '=', cancelRelocId).execute()
  })
})
