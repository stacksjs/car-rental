import { afterAll, beforeAll, describe, expect, test } from '@stacksjs/testing'

let HostProfile: any
let Car: any
let toAttrs: <T = any>(v: any) => T
let db: any

beforeAll(async () => {
  const models = await import('../../storage/framework/auto-imports/models')
  HostProfile = (models as any).HostProfile
  Car = (models as any).Car
  ;({ toAttrs } = await import('@stacksjs/orm'))
  ;({ db } = await import('@stacksjs/database'))
})

const TEST_USER_ID = 999_001 // Synthetic; tests clean up after themselves
let createdProfileId: number | null = null

afterAll(async () => {
  if (createdProfileId)
    await db.deleteFrom('host_profiles').where('id', '=', createdProfileId).execute()
})

describe('HostProfile model', () => {
  test('boolean casts return JS booleans, not "0"/"1" strings', async () => {
    // Insert raw with snake_case columns + numeric flags so we exercise the
    // exact stored shape that production rows use.
    await db.insertInto('host_profiles').values({
      user_id: TEST_USER_ID,
      bio: 'cast probe',
      joined_at: new Date().toISOString(),
      trips: 0,
      rating: 5,
      response_rate: 100,
      response_time: '< 1 hour',
      verified: 0,
      all_star: 0,
      charges_enabled: 0,
      payouts_enabled: 0,
      platform_fee_bps: 1500,
      uuid: crypto.randomUUID(),
    }).execute()

    const hp: any = await HostProfile.query().where('user_id', TEST_USER_ID).first()
    createdProfileId = hp?.id ?? null

    expect(typeof hp.charges_enabled).toBe('boolean')
    expect(hp.charges_enabled).toBe(false)
    expect(typeof hp.payouts_enabled).toBe('boolean')
    expect(hp.payouts_enabled).toBe(false)
    expect(typeof hp.verified).toBe('boolean')
    expect(typeof hp.all_star).toBe('boolean')
    expect(typeof hp.trips).toBe('number')
    expect(typeof hp.platform_fee_bps).toBe('number')
    expect(hp.platform_fee_bps).toBe(1500)
  })

  test('static HostProfile.update flips boolean columns and round-trips', async () => {
    if (!createdProfileId) return // first test failed; skip safely
    const updated: any = await HostProfile.update(createdProfileId, {
      charges_enabled: 1,
      payouts_enabled: 1,
    })
    expect(updated.charges_enabled).toBe(true)
    expect(updated.payouts_enabled).toBe(true)

    const refetched: any = await HostProfile.find(createdProfileId)
    expect(refetched.charges_enabled).toBe(true)
  })

  test('toAttrs returns a plain bag without internal fields', async () => {
    if (!createdProfileId) return
    const hp = await HostProfile.find(createdProfileId)
    const plain = toAttrs<any>(hp)
    expect('_attributes' in plain).toBe(false)
    expect(plain.id).toBe(createdProfileId)
    expect(typeof plain.charges_enabled).toBe('boolean')
  })
})
