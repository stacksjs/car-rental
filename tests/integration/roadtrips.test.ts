/**
 * E2E tests for the roadtrip planner / multi-leg apply flow against the live
 * `./buddy dev --api` server. Builds a two-host scenario:
 *
 *   Host A posts: City1 → City2
 *   Host B posts: City2 → City3
 *
 * A driver plans City1 → City3, saves the chain as a roadtrip, applies to
 * every leg in one shot, and we verify status propagates from each
 * relocation action back into the leg row. Skips automatically when the
 * server isn't reachable.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

const API_BASE = process.env.E2E_API_BASE ?? 'http://127.0.0.1:3008'
const TS = Date.now()
const HOST_A_EMAIL = `rt-host-a-${TS}@drivly.app`
const HOST_B_EMAIL = `rt-host-b-${TS}@drivly.app`
const DRIVER_EMAIL = `rt-driver-${TS}@drivly.app`
const DRIVER_2_EMAIL = `rt-driver2-${TS}@drivly.app`
const PW = 'roadtrip-pw-1234'

// Use unique-enough city names so the planner's substring match doesn't
// collide with seeded data in the dev DB.
const CITY_A = `Hubsville${TS}`
const CITY_B = `Midpoint${TS}`
const CITY_C = `Endtown${TS}`

let serverUp = false
let hostAToken: string | null = null
let hostBToken: string | null = null
let driverToken: string | null = null
let driver2Token: string | null = null
let relocAB: number | null = null
let relocBC: number | null = null
let testCarA: number | null = null
let testCarB: number | null = null
let originalCarAHost: number | null = null
let originalCarBHost: number | null = null
let tripId: number | null = null
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

async function registerAndHost(email: string): Promise<{ token: string, hostProfileId: number }> {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: email.split('@')[0], email, password: PW }),
  })
  expect(reg.status).toBe(200)
  const token = reg.body.token
  const apply = await api('/api/host/apply', { method: 'POST', body: '{}' }, token)
  expect(apply.status).toBe(200)
  const userRow = await db.selectFrom('users').select(['id']).where('email', '=', email).executeTakeFirst()
  const hpRow = await db.selectFrom('host_profiles').select(['id']).where('user_id', '=', userRow.id).executeTakeFirst()
  return { token, hostProfileId: Number(hpRow.id) }
}

// 30s hook timeout — `await import('@stacksjs/database')` does heavy
// transitive module resolution on first load, which can take longer
// than bun:test's default 5s hook budget on a cold cache.
beforeAll(async () => {
  serverUp = await apiAvailable()
  if (!serverUp) {
    // eslint-disable-next-line no-console
    console.log(`[roadtrips.test] Skipping — ${API_BASE}/v1/status not reachable`)
    return
  }
  ;({ db } = await import('@stacksjs/database'))
}, 30000)

afterAll(async () => {
  if (!db) return
  // Wipe the trip + legs first (FK direction), then the apps + relocations.
  if (tripId) {
    await db.deleteFrom('roadtrip_legs').where('roadtrip_id', '=', tripId).execute()
    await db.deleteFrom('roadtrips').where('id', '=', tripId).execute()
  }
  for (const id of [relocAB, relocBC].filter(Boolean) as number[]) {
    await db.deleteFrom('relocation_applications').where('relocation_id', '=', id).execute()
    await db.deleteFrom('relocations').where('id', '=', id).execute()
  }
  if (testCarA) await db.updateTable('cars').set({ host_profile_id: originalCarAHost }).where('id', '=', testCarA).execute()
  if (testCarB) await db.updateTable('cars').set({ host_profile_id: originalCarBHost }).where('id', '=', testCarB).execute()
  for (const email of [HOST_A_EMAIL, HOST_B_EMAIL, DRIVER_EMAIL, DRIVER_2_EMAIL])
    await db.deleteFrom('users').where('email', '=', email).execute()
})

describe('Roadtrips e2e', () => {
  test('two hosts post a chainable A→B and B→C pair', async () => {
    if (!serverUp) return
    const a = await registerAndHost(HOST_A_EMAIL)
    hostAToken = a.token
    const b = await registerAndHost(HOST_B_EMAIL)
    hostBToken = b.token

    // Re-parent two existing cars so the host_profile_id check passes.
    const cars = await db.selectFrom('cars').select(['id', 'host_profile_id']).orderBy('id', 'asc').limit(2).execute()
    testCarA = Number(cars[0].id)
    testCarB = Number(cars[1].id)
    originalCarAHost = cars[0].host_profile_id == null ? null : Number(cars[0].host_profile_id)
    originalCarBHost = cars[1].host_profile_id == null ? null : Number(cars[1].host_profile_id)
    await db.updateTable('cars').set({ host_profile_id: a.hostProfileId }).where('id', '=', testCarA).execute()
    await db.updateTable('cars').set({ host_profile_id: b.hostProfileId }).where('id', '=', testCarB).execute()

    const ab = await api('/api/relocations', {
      method: 'POST',
      body: JSON.stringify({
        car_id: testCarA,
        pickup_address: `100 Main, ${CITY_A}, CA`,
        dropoff_address: `200 Main, ${CITY_B}, NV`,
        earliest_pickup_date: '2030-06-01',
        latest_dropoff_date: '2030-06-05',
        estimated_distance_miles: 300,
        compensation_type: 'flat',
        flat_fee: 180,
        fuel_allowance: 50,
        max_extra_days: 2,
      }),
    }, hostAToken)
    expect(ab.status).toBe(200)
    relocAB = ab.body.data.id

    const bc = await api('/api/relocations', {
      method: 'POST',
      body: JSON.stringify({
        car_id: testCarB,
        pickup_address: `300 Main, ${CITY_B}, NV`,
        dropoff_address: `400 Main, ${CITY_C}, NY`,
        earliest_pickup_date: '2030-06-04',
        latest_dropoff_date: '2030-06-15',
        estimated_distance_miles: 1800,
        compensation_type: 'per_mile',
        per_mile_rate: 0.4,
        fuel_allowance: 100,
        max_extra_days: 3,
      }),
    }, hostBToken)
    expect(bc.status).toBe(200)
    relocBC = bc.body.data.id
  })

  test('planner returns the A→B→C chain with both legs in order', async () => {
    if (!serverUp) return
    const qs = new URLSearchParams({
      from: CITY_A,
      to: CITY_C,
      earliest: '2030-06-01',
      latest: '2030-06-15',
    })
    const { status, body } = await api(`/api/roadtrips/plan?${qs}`)
    expect(status).toBe(200)
    expect(Array.isArray(body.data)).toBe(true)

    const myChain = (body.data || []).find((c: any) =>
      c.legs?.length === 2
      && Number(c.legs[0].relocation_id) === relocAB
      && Number(c.legs[1].relocation_id) === relocBC,
    )
    expect(myChain).toBeTruthy()
    // Bonus extra days surface as a separate value indicator (2 + 3).
    expect(myChain.total_extra_days).toBe(5)
    // total_pay = leg1 (180 + 50) + leg2 (round(0.4 * 1800) + 100) = 230 + 820 = 1050
    expect(myChain.total_pay).toBe(1050)
  })

  test('planner rejects chains whose final dropoff would exceed user latest', async () => {
    if (!serverUp) return
    // Squeeze the window so leg BC's latest_dropoff_date (2030-06-15) is
    // past `latest` — chain should be filtered out.
    const qs = new URLSearchParams({
      from: CITY_A,
      to: CITY_C,
      earliest: '2030-06-01',
      latest: '2030-06-10',
    })
    const { body } = await api(`/api/roadtrips/plan?${qs}`)
    const myChain = (body.data || []).find((c: any) =>
      Number(c.legs?.[0]?.relocation_id) === relocAB
      && Number(c.legs?.[1]?.relocation_id) === relocBC,
    )
    expect(myChain).toBeFalsy()
  })

  test('driver registers and saves the chain as a roadtrip — leg pricing is snapshotted', async () => {
    if (!serverUp) return
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Trip Driver', email: DRIVER_EMAIL, password: PW }),
    })
    expect(reg.status).toBe(200)
    driverToken = reg.body.token

    const create = await api('/api/roadtrips', {
      method: 'POST',
      body: JSON.stringify({
        title: `${CITY_A} → ${CITY_C}`,
        origin_address: `100 Main, ${CITY_A}, CA`,
        origin_city: CITY_A.toLowerCase(),
        destination_address: `400 Main, ${CITY_C}, NY`,
        destination_city: CITY_C.toLowerCase(),
        earliest_start_date: '2030-06-01',
        latest_end_date: '2030-06-15',
        legs: [{ relocation_id: relocAB }, { relocation_id: relocBC }],
      }),
    }, driverToken)
    expect(create.status).toBe(200)
    tripId = create.body.data.id
    expect(create.body.data.leg_count).toBe(2)

    const show = await api(`/api/roadtrips/${tripId}`, {}, driverToken)
    expect(show.status).toBe(200)
    expect(show.body.data.legs.length).toBe(2)
    // Snapshot fields land on the leg, not just the relocation row.
    const leg1 = show.body.data.legs[0]
    expect(leg1.compensation_type).toBe('flat')
    expect(Number(leg1.flat_fee)).toBe(180)
    expect(Number(leg1.fuel_allowance)).toBe(50)
    expect(Number(leg1.estimated_pay)).toBe(230)
    // Total = sum of snapshots, not a re-query of relocation pricing.
    expect(show.body.data.total_pay).toBe(1050)
    expect(show.body.data.total_extra_days).toBe(5)
  })

  test('host edit to a relocation does NOT change the saved trip total (snapshot semantics)', async () => {
    if (!serverUp || !relocAB || !tripId) return
    // Host A drops the flat_fee from 180 to 50 after the driver saved the
    // chain. The trip's snapshot must hold the original $230 leg estimate.
    await db.updateTable('relocations').set({ flat_fee: 50 }).where('id', '=', relocAB).execute()
    const show = await api(`/api/roadtrips/${tripId}`, {}, driverToken)
    expect(show.status).toBe(200)
    const leg1 = show.body.data.legs.find((l: any) => Number(l.relocation_id) === relocAB)
    expect(Number(leg1.estimated_pay)).toBe(230)
    expect(show.body.data.total_pay).toBe(1050)
    // Restore so later assertions about pay stay clean.
    await db.updateTable('relocations').set({ flat_fee: 180 }).where('id', '=', relocAB).execute()
  })

  test('apply-all submits applications to every leg and reports per-leg results', async () => {
    if (!serverUp || !tripId) return
    const { status, body } = await api(`/api/roadtrips/${tripId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ message: 'I want this whole trip' }),
    }, driverToken)
    expect(status).toBe(200)
    expect(body.applied).toBe(2)
    expect(body.skipped).toBe(0)
    expect(body.total).toBe(2)
    expect(body.data.length).toBe(2)
    expect(body.data.every((r: any) => r.ok && r.application?.status === 'pending')).toBe(true)
  })

  test('host A approves the driver — leg AB flips to approved (status propagation)', async () => {
    if (!serverUp || !relocAB) return
    const apps = await db.selectFrom('relocation_applications')
      .select(['id'])
      .where('relocation_id', '=', relocAB)
      .where('status', '=', 'pending')
      .execute()
    const appId = Number(apps[0].id)
    const approve = await api(`/api/relocations/${relocAB}/applications/${appId}/approve`, {
      method: 'POST', body: '{}',
    }, hostAToken)
    expect(approve.status).toBe(200)

    const show = await api(`/api/roadtrips/${tripId}`, {}, driverToken)
    const leg = show.body.data.legs.find((l: any) => Number(l.relocation_id) === relocAB)
    expect(leg.status).toBe('approved')
  })

  test('competing driver\'s leg flips to rejected when host approves someone else', async () => {
    if (!serverUp || !relocBC) return
    // Spin up driver 2 who also wants leg BC. They'll lose to driver 1.
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Trip Driver 2', email: DRIVER_2_EMAIL, password: PW }),
    })
    expect(reg.status).toBe(200)
    driver2Token = reg.body.token

    const trip2 = await api('/api/roadtrips', {
      method: 'POST',
      body: JSON.stringify({
        title: 'driver2 chain',
        origin_address: `300 Main, ${CITY_B}, NV`,
        destination_address: `400 Main, ${CITY_C}, NY`,
        earliest_start_date: '2030-06-04',
        latest_end_date: '2030-06-15',
        legs: [{ relocation_id: relocBC }],
      }),
    }, driver2Token)
    expect(trip2.status).toBe(200)
    const trip2Id = trip2.body.data.id

    await api(`/api/roadtrips/${trip2Id}/apply`, { method: 'POST', body: '{}' }, driver2Token)

    // Host B approves driver 1 (the original).
    const apps = await db.selectFrom('relocation_applications')
      .select(['id', 'user_id'])
      .where('relocation_id', '=', relocBC)
      .where('status', '=', 'pending')
      .execute()
    const driver1User = await db.selectFrom('users').select(['id']).where('email', '=', DRIVER_EMAIL).executeTakeFirst()
    const driver1AppId = Number(apps.find((a: any) => Number(a.user_id) === Number(driver1User.id))?.id)
    expect(driver1AppId).toBeGreaterThan(0)

    const approve = await api(`/api/relocations/${relocBC}/applications/${driver1AppId}/approve`, {
      method: 'POST', body: '{}',
    }, hostBToken)
    expect(approve.status).toBe(200)

    // Driver 2's leg now reflects the loss — even though they themselves did
    // nothing — without needing them to refresh.
    const show2 = await api(`/api/roadtrips/${trip2Id}`, {}, driver2Token)
    const leg2 = show2.body.data.legs[0]
    expect(leg2.status).toBe('rejected')

    // Cleanup the driver 2 trip — it'd otherwise leak across the suite.
    await db.deleteFrom('roadtrip_legs').where('roadtrip_id', '=', trip2Id).execute()
    await db.deleteFrom('roadtrips').where('id', '=', trip2Id).execute()
  })

  test('start + complete flow propagates in_progress / completed onto the leg', async () => {
    if (!serverUp || !relocAB) return
    const start = await api(`/api/relocations/${relocAB}/start`, {
      method: 'POST',
      body: JSON.stringify({ start_odometer: 30000 }),
    }, driverToken)
    expect(start.status).toBe(200)
    {
      const show = await api(`/api/roadtrips/${tripId}`, {}, driverToken)
      const leg = show.body.data.legs.find((l: any) => Number(l.relocation_id) === relocAB)
      expect(leg.status).toBe('in_progress')
    }

    const complete = await api(`/api/relocations/${relocAB}/complete`, {
      method: 'POST',
      body: JSON.stringify({ end_odometer: 30310 }),
    }, driverToken)
    expect(complete.status).toBe(200)
    expect(complete.body.data.payout_amount).toBe(230) // flat 180 + fuel 50
    {
      const show = await api(`/api/roadtrips/${tripId}`, {}, driverToken)
      const leg = show.body.data.legs.find((l: any) => Number(l.relocation_id) === relocAB)
      expect(leg.status).toBe('completed')
    }
  })

  test('withdraw on the in-flight leg BC: relocation reverts to open, leg cancelled', async () => {
    if (!serverUp || !relocBC) return
    const withdraw = await api(`/api/relocations/${relocBC}/withdraw`, {
      method: 'POST', body: '{}',
    }, driverToken)
    expect(withdraw.status).toBe(200)
    expect(withdraw.body.data.application.status).toBe('withdrawn')
    expect(withdraw.body.data.relocation.status).toBe('open')
    expect(withdraw.body.data.relocation.driver_id).toBeFalsy()

    const show = await api(`/api/roadtrips/${tripId}`, {}, driverToken)
    const leg = show.body.data.legs.find((l: any) => Number(l.relocation_id) === relocBC)
    expect(leg.status).toBe('cancelled')
  })

  test('cannot withdraw once the relocation is in_progress (host-cancel only)', async () => {
    if (!serverUp || !relocBC) return
    // Build a fresh single-leg flow on the (now re-opened) BC relocation.
    const apply = await api(`/api/relocations/${relocBC}/apply`, {
      method: 'POST', body: JSON.stringify({ message: 'second chance' }),
    }, driverToken)
    expect(apply.status).toBe(200)
    const apps = await db.selectFrom('relocation_applications')
      .select(['id', 'user_id'])
      .where('relocation_id', '=', relocBC)
      .where('status', '=', 'pending')
      .execute()
    const myApp = apps.find((a: any) => Number(a.user_id) > 0)
    expect(myApp).toBeTruthy()
    await api(`/api/relocations/${relocBC}/applications/${Number(myApp!.id)}/approve`, {
      method: 'POST', body: '{}',
    }, hostBToken)
    await api(`/api/relocations/${relocBC}/start`, {
      method: 'POST', body: JSON.stringify({ start_odometer: 80000 }),
    }, driverToken)

    const w = await api(`/api/relocations/${relocBC}/withdraw`, {
      method: 'POST', body: '{}',
    }, driverToken)
    expect(w.status).toBe(400)
    expect(String(w.body?.message ?? w.body?.error ?? '')).toMatch(/in progress/i)
  })
})
