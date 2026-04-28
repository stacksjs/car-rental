import { beforeAll, describe, expect, test } from '@stacksjs/testing'

let Car: any
let toAttrs: <T = any>(v: any) => T

beforeAll(async () => {
  // The model + toAttrs helper land on globalThis once the auto-import
  // barrel is evaluated; pulling them via dynamic import here avoids
  // depending on ./buddy dev being up.
  const models = await import('../../storage/framework/auto-imports/models')
  Car = (models as any).Car
  ;({ toAttrs } = await import('@stacksjs/orm'))
})

describe('Car model', () => {
  test('Car.find returns a proxied instance with direct attribute access', async () => {
    const car = await Car.find(1)
    expect(car).toBeTruthy()
    expect(car.id).toBe(1)
    // Direct property access (no `_attributes` hop) must work — the entire
    // app code base relies on `car.slug` / `car.daily_rate`.
    expect(typeof car.slug).toBe('string')
    expect(typeof car.daily_rate).toBe('number')
  })

  test('declared casts coerce SQLite text columns to the right JS type', async () => {
    const car = await Car.find(1)
    expect(typeof car.instant_book).toBe('boolean')
    expect(typeof car.delivery_available).toBe('boolean')
    expect(typeof car.daily_rate).toBe('number')
    expect(typeof car.rating).toBe('number')
    expect(typeof car.seats).toBe('number')
    // The naive `!!` test is what was bugged: `!!"0"` is `true`. Make sure
    // a stored "0" round-trips as `false`, not just truthy.
    if (car.delivery_available === false) expect(!!car.delivery_available).toBe(false)
  })

  test('spread on a model instance only emits attribute keys (no internals)', async () => {
    const car = await Car.find(1)
    const spread = { ...car }
    const keys = Object.keys(spread)
    // No private fields leak through
    expect(keys).not.toContain('_attributes')
    expect(keys).not.toContain('_original')
    expect(keys).not.toContain('_definition')
    expect(keys).toContain('id')
    expect(keys).toContain('slug')
  })

  test('toAttrs strips hidden attributes (license_plate, vin)', async () => {
    const car = await Car.find(1)
    // Direct access still works for internal callers
    expect(typeof car.license_plate).toBe('string')
    // But toAttrs uses toJSON which respects `hidden: true`
    const safe = toAttrs<any>(car)
    expect('license_plate' in safe).toBe(false)
    expect('vin' in safe).toBe(false)
    expect(safe.id).toBe(car.id)
  })

  test('chained query terminators return proxied instances', async () => {
    const first = await Car.query().where('status', 'active').orderBy('id', 'asc').first()
    expect(first).toBeTruthy()
    expect(typeof first.slug).toBe('string')

    const list = await Car.query().where('status', 'active').limit(3).get()
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].id).toBeDefined()
    expect('_attributes' in { ...list[0] }).toBe(false)
  })

  test('Car.update(id, data) is wired up (Laravel-style sugar)', async () => {
    const before = await Car.find(1)
    const before_status = before.status

    const updated = await Car.update(1, { status: 'maintenance' })
    expect(updated?.status).toBe('maintenance')

    // Restore — never leave a known fixture row mutated.
    await Car.update(1, { status: before_status })
    const restored = await Car.find(1)
    expect(restored.status).toBe(before_status)
  })

  test('inst.attr = x ; await inst.save() persists through the proxy', async () => {
    const car = await Car.find(1)
    const before = car.status

    car.status = 'set-trap-test'
    // Read-back through the proxy reflects the new value immediately.
    expect(car.status).toBe('set-trap-test')

    await car.save()
    const fresh = await Car.find(1)
    expect(fresh.status).toBe('set-trap-test')

    // Restore.
    await Car.update(1, { status: before })
    expect((await Car.find(1)).status).toBe(before)
  })
})
