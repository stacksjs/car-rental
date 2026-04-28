/**
 * Stacks-specific defineModel() extensions, exercised against the real
 * dev DB. Locks the framework behaviors in so future stacks refactors
 * can't quietly regress them. (The same tests can't easily run from the
 * standalone stacks repo because `@stacksjs/orm`'s `index.ts` eagerly
 * `await import`s the project's User model — an architectural choice that
 * pre-dates this work and means every framework test needs a scaffolded
 * project around it.)
 */

import { afterAll, beforeAll, describe, expect, test } from '@stacksjs/testing'

let Car: any
let Booking: any
let HostProfile: any
let toAttrs: <T = any>(v: any) => T

beforeAll(async () => {
  const models = await import('../../storage/framework/auto-imports/models')
  Car = (models as any).Car
  Booking = (models as any).Booking
  HostProfile = (models as any).HostProfile
  ;({ toAttrs } = await import('@stacksjs/orm'))
})

describe('framework — Model.update(id, data)', () => {
  test('exists as a static method even though bun-query-builder doesn\'t ship one', () => {
    expect(typeof (Car as any).update).toBe('function')
    expect(typeof (Booking as any).update).toBe('function')
    expect(typeof (HostProfile as any).update).toBe('function')
  })

  test('runs user-defined `set:` hooks (security: no plaintext passwords through static.update)', async () => {
    const { db } = await import('@stacksjs/database')
    const { User } = await import('../../storage/framework/auto-imports/models')
    const row = await db.selectFrom('users').selectAll().where('email', '=', 'e2e@drivly.app').executeTakeFirst()
    if (!row) return // dev DB hasn't been seeded with this fixture

    const orig = row.password as string
    await (User as any).update(row.id, { password: 'plain-via-static-update' })

    const after = await db.selectFrom('users').selectAll().where('id', '=', row.id).executeTakeFirst()
    // Bcrypt format: $2a$/$2b$/$2x$/$2y$ + cost + salt + hash
    expect(/^\$2[abxy]\$\d+\$/.test(after.password as string)).toBe(true)
    expect(after.password).not.toBe('plain-via-static-update')

    // Restore.
    await db.updateTable('users').set({ password: orig }).where('id', '=', row.id).execute()
  })

  test('rejects null id with a clear error', async () => {
    let err: Error | null = null
    try { await (Car as any).update(null, { status: 'x' }) } catch (e) { err = e as Error }
    expect(err).toBeTruthy()
    expect(err!.message).toMatch(/id/i)
  })

  test('rejects non-object data with a clear error', async () => {
    let err: Error | null = null
    try { await (Car as any).update(1, 'bogus' as any) } catch (e) { err = e as Error }
    expect(err).toBeTruthy()
    expect(err!.message).toMatch(/data object/i)
  })

  test('returns the updated row (find-after-update)', async () => {
    const before = await Car.find(1)
    const updated = await Car.update(1, { status: 'orm-test' })
    expect(updated.id).toBe(1)
    expect(updated.status).toBe('orm-test')
    await Car.update(1, { status: before.status })
  })
})

describe('framework — ModelInstance proxy semantics', () => {
  test('attribute access goes through _attributes (not undefined)', async () => {
    const car = await Car.find(1)
    expect(typeof car.slug).toBe('string')
    expect(typeof car.daily_rate).toBe('number')
    // Internal field still accessible for callers that explicitly want it.
    expect(typeof car._attributes).toBe('object')
  })

  test('inst.attr = x ; inst.save() persists the change AND tracks dirtiness', async () => {
    const car = await Car.find(1)
    const before = car.status
    car.status = 'proxy-set-test'
    expect(car.status).toBe('proxy-set-test')
    await car.save()
    expect((await Car.find(1)).status).toBe('proxy-set-test')
    await Car.update(1, { status: before })
  })

  test('spread emits attribute keys without internal fields', async () => {
    const car = await Car.find(1)
    const spread = { ...car }
    expect('_attributes' in spread).toBe(false)
    expect('_original' in spread).toBe(false)
    expect('_definition' in spread).toBe(false)
    expect('id' in spread).toBe(true)
  })

  test('JSON.stringify uses toJSON to drop hidden fields', async () => {
    const car = await Car.find(1)
    // license_plate and vin are declared `hidden: true` on the Car model.
    const json = JSON.parse(JSON.stringify(car))
    expect('license_plate' in json).toBe(false)
    expect('vin' in json).toBe(false)
    expect('id' in json).toBe(true)
  })

  test('Object.keys reflects attribute keys, not internals', async () => {
    const car = await Car.find(1)
    const keys = Object.keys(car)
    expect(keys).not.toContain('_attributes')
    expect(keys).not.toContain('_original')
    expect(keys).toContain('id')
  })

  test('chained where().first() returns proxied + cast instances', async () => {
    const car = await Car.query().where('id', 1).first()
    expect(car.id).toBe(1)
    expect(typeof car.instant_book).toBe('boolean')
    expect(typeof car.daily_rate).toBe('number')
  })
})

describe('framework — toAttrs helper', () => {
  test('handles null / undefined / primitives without crashing', () => {
    expect(toAttrs(null)).toBeNull()
    expect(toAttrs(undefined)).toBeUndefined()
    expect(toAttrs(42)).toBe(42)
    expect(toAttrs('hi')).toBe('hi')
  })

  test('arrays of instances → array of plain attribute bags', async () => {
    const cars = await Car.query().limit(2).get()
    const plain = toAttrs<any[]>(cars)
    expect(Array.isArray(plain)).toBe(true)
    expect(plain.length).toBe(2)
    for (const c of plain) {
      expect('_attributes' in c).toBe(false)
      // hidden fields are stripped via toJSON
      expect('license_plate' in c).toBe(false)
    }
  })

  test('plain objects pass through unchanged', () => {
    const obj = { a: 1, b: 'x' }
    expect(toAttrs(obj)).toBe(obj as any)
  })
})
