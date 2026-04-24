/**
 * Drivly-flavoured seeder — run AFTER ./buddy migrate:fresh --seed.
 *
 * Replaces the faker-generated rows with the 12 hardcoded cars + 8 hosts +
 * 10 cities + 5 extras from the drivly example. Keeps slugs stable so the
 * existing stx UI (which hard-links to /cars/<slug>) works without template
 * changes.
 *
 * Run: bun database/seeders/DrivlySeeder.ts
 */

import { Database } from 'bun:sqlite'
import { cars as drivlyCars } from '../../resources/data/cars'

const dbPath = new URL('../stacks.sqlite', import.meta.url).pathname
const db = new Database(dbPath)

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function run(): void {
  console.log(`[DrivlySeeder] DB: ${dbPath}`)

  db.exec('BEGIN')
  try {
    db.exec('DELETE FROM bookings')
    db.exec('DELETE FROM reviews')
    db.exec('DELETE FROM car_photos')
    db.exec('DELETE FROM cars')
    db.exec('DELETE FROM host_profiles')
    db.exec('DELETE FROM locations')
    db.exec('DELETE FROM extras')
    db.exec('DELETE FROM users')

    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    insertUser.run('Admin', 'admin@drivly.app', '$2b$12$seed.placeholder.hash', 'admin')
    const guestRes = insertUser.run('Maya Lee', 'maya@drivly.app', '$2b$12$seed.placeholder.hash', 'guest')
    const guestUserId = Number(guestRes.lastInsertRowid)

    const insertHost = db.prepare(
      `INSERT INTO host_profiles (user_id, bio, joined_at, trips, rating, response_rate, response_time, verified, all_star, platform_fee_bps, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1500, CURRENT_TIMESTAMP)`,
    )
    const hostProfileBySlug = new Map<string, number>()
    const uniqueHosts = new Map<string, any>()
    for (const c of drivlyCars) uniqueHosts.set(c.host.id, c.host)
    for (const h of uniqueHosts.values()) {
      const email = `${slugify(h.name)}@drivly.app`
      const uRes = insertUser.run(h.name, email, '$2b$12$seed.placeholder.hash', 'host')
      const uid = Number(uRes.lastInsertRowid)
      const hp = insertHost.run(
        uid,
        `Host since ${h.joined}.`,
        new Date(h.joined + ' 01').toISOString(),
        h.trips, h.rating, h.responseRate, h.responseTime,
        h.verified ? 1 : 0, h.allStar ? 1 : 0,
      )
      hostProfileBySlug.set(h.id, Number(hp.lastInsertRowid))
    }

    const insertLoc = db.prepare(
      `INSERT INTO locations (name, state, country, listing_count, image, created_at)
       VALUES (?, ?, 'US', ?, ?, CURRENT_TIMESTAMP)`,
    )
    const locBySlug = new Map<string, number>()
    for (const c of drivlyCars) {
      const parts = c.location.split(',').map(s => s.trim())
      const key = `${parts[0]}-${parts[1] || 'US'}`
      if (!locBySlug.has(key)) {
        const res = insertLoc.run(
          parts[0], (parts[1] || 'US').slice(0, 2),
          1000, `https://images.unsplash.com/photo-${1500000000000 + key.length * 1000}?w=800`,
        )
        locBySlug.set(key, Number(res.lastInsertRowid))
      }
    }

    const insertCar = db.prepare(
      `INSERT INTO cars
       (slug, make, model, year, trim, daily_rate, original_price, seats, doors, transmission, fuel_type, mpg, range, category, description, image, license_plate, vin, instant_book, delivery_available, status, rating, review_count, trips, host_profile_id, location_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    const insertPhoto = db.prepare(
      `INSERT INTO car_photos (url, position, is_primary, car_id, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    for (const c of drivlyCars) {
      const parts = c.location.split(',').map(s => s.trim())
      const locKey = `${parts[0]}-${parts[1] || 'US'}`
      const locId = locBySlug.get(locKey)
      const hostProfileId = hostProfileBySlug.get(c.host.id)

      const plate = (c.slug.replace(/[^A-Z0-9]/gi, '').slice(0, 7) || 'SEED001').toUpperCase()
      const vin = `VIN${(c.slug.replace(/[^A-Z0-9]/gi, '') + '000000000').slice(0, 14).toUpperCase()}`

      const res = insertCar.run(
        c.slug, c.make, c.model, c.year, c.trim ?? null,
        c.price, c.originalPrice ?? null, c.seats, c.doors, c.transmission, c.fuelType,
        c.mpg, c.range ?? null, c.category, c.description, c.image, plate, vin,
        c.instantBook ? 1 : 0, c.deliveryAvailable ? 1 : 0,
        c.rating, c.reviewCount, c.trips, hostProfileId ?? null, locId ?? null,
      )
      const carId = Number(res.lastInsertRowid)

      c.gallery.forEach((url, i) => {
        insertPhoto.run(url, i, i === 0 ? 1 : 0, carId)
      })
    }

    const insertExtra = db.prepare(
      `INSERT INTO extras (code, name, description, price_per_day, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    const extras = [
      { code: 'child-seat',  name: 'Child seat',        desc: 'Infant or toddler seat', price: 12 },
      { code: 'toll-pass',   name: 'Toll pass',         desc: 'Unlimited toll pass',    price: 18 },
      { code: 'charger',     name: 'EV charger',        desc: 'Portable Level 2 charger', price: 15 },
      { code: 'refuel',      name: 'Prepaid refuel',    desc: 'Return with any level', price: 45 },
      { code: 'add-driver',  name: 'Additional driver', desc: 'Share the wheel',       price: 10 },
    ]
    for (const e of extras) {
      insertExtra.run(e.code, e.name, e.desc, e.price)
    }

    const insertReview = db.prepare(
      `INSERT INTO reviews (rating, body, car_id, user_id, created_at) VALUES (?, ?, ?, ?, datetime(?))`,
    )
    const carIds = db.query<{ id: number, slug: string }, []>('SELECT id, slug FROM cars').all()
    const carIdBySlug = new Map(carIds.map(c => [c.slug, c.id]))
    for (const c of drivlyCars) {
      const carId = carIdBySlug.get(c.slug)
      if (!carId) continue
      for (const r of c.reviews) {
        insertReview.run(r.rating, r.body, carId, guestUserId, r.date)
      }
    }

    db.exec('COMMIT')
    console.log(`[DrivlySeeder] Seeded ${drivlyCars.length} cars, ${uniqueHosts.size} hosts, ${locBySlug.size} locations, ${extras.length} extras.`)
  }
  catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

run()
db.close()
