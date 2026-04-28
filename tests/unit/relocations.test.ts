import { afterAll, beforeAll, describe, expect, test } from '@stacksjs/testing'

let Relocation: any
let RelocationApplication: any
let toAttrs: <T = any>(v: any) => T
let db: any

const HOST_PROFILE_ID = 1 // any existing seed row works for FK shape

beforeAll(async () => {
  const models = await import('../../storage/framework/auto-imports/models')
  Relocation = (models as any).Relocation
  RelocationApplication = (models as any).RelocationApplication
  ;({ toAttrs } = await import('@stacksjs/orm'))
  ;({ db } = await import('@stacksjs/database'))
})

const createdRelocs: number[] = []
const createdApps: number[] = []

afterAll(async () => {
  if (!db) return
  for (const id of createdApps)
    await db.deleteFrom('relocation_applications').where('id', '=', id).execute()
  for (const id of createdRelocs)
    await db.deleteFrom('relocations').where('id', '=', id).execute()
})

describe('Relocation model', () => {
  test('Relocation.create returns a proxied instance with casts applied', async () => {
    const r: any = await Relocation.create({
      car_id: 1,
      host_profile_id: HOST_PROFILE_ID,
      pickup_address: 'A',
      dropoff_address: 'B',
      earliest_pickup_date: '2030-03-01',
      latest_dropoff_date: '2030-03-04',
      estimated_distance_miles: 250,
      compensation_type: 'flat',
      flat_fee: 175,
      per_mile_rate: 0,
      fuel_allowance: 40,
      max_extra_days: 0,
      min_age: 21,
      license_required: 1,
      status: 'open',
      notes: 'unit-test',
    })
    createdRelocs.push(Number(r.id))

    expect(r.id).toBeDefined()
    expect(r.status).toBe('open')
    expect(r.flat_fee).toBe(175)
    // Boolean cast must apply on the create() return path too.
    expect(typeof r.license_required).toBe('boolean')
    expect(r.license_required).toBe(true)
    // Integer cast survives even when the underlying SQLite text comes back.
    expect(typeof r.estimated_distance_miles).toBe('number')
    expect(r.estimated_distance_miles).toBe(250)
  })

  test('queries through where()...first() return proxied + cast instances', async () => {
    const id = createdRelocs[0]
    const r: any = await Relocation.query().where('id', id).first()
    expect(r).toBeTruthy()
    expect(r.id).toBe(id)
    expect(typeof r.license_required).toBe('boolean')
    // Direct attribute access on chain-returned rows must work.
    expect(r.notes).toBe('unit-test')
  })

  test('Relocation.update flips status and persists the change', async () => {
    const id = createdRelocs[0]
    const updated: any = await Relocation.update(id, { status: 'cancelled' })
    expect(updated.status).toBe('cancelled')
    const refetched: any = await Relocation.find(id)
    expect(refetched.status).toBe('cancelled')
  })
})

describe('RelocationApplication model', () => {
  test('Application.create + retrieval round-trips with status default', async () => {
    const relocId = createdRelocs[0]
    expect(relocId).toBeTruthy()
    const a: any = await RelocationApplication.create({
      relocation_id: relocId,
      user_id: 1,
      status: 'pending',
      message: 'unit-test driver pitch',
    })
    createdApps.push(Number(a.id))
    expect(a.id).toBeDefined()
    expect(a.status).toBe('pending')
    expect(a.message).toMatch(/unit-test/)

    const fresh: any = await RelocationApplication.find(a.id)
    expect(fresh.relocation_id).toBe(relocId)
    expect(fresh.status).toBe('pending')
  })
})
