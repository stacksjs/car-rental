/**
 * Seed a handful of demo relocation postings so the /relocations UI has
 * real content to render. Each row references an existing seeded car/host
 * so detail pages link cleanly.
 *
 * Run: bun database/seeders/RelocationsSeeder.ts
 */

import { Database } from 'bun:sqlite'

const dbPath = new URL('../stacks.sqlite', import.meta.url).pathname
const db = new Database(dbPath)

interface CarRow { id: number, slug: string, host_profile_id: number | null }

function run(): void {
  console.log(`[RelocationsSeeder] DB: ${dbPath}`)

  const cars = db.query<CarRow, []>(
    `SELECT id, slug, host_profile_id FROM cars WHERE host_profile_id IS NOT NULL LIMIT 6`,
  ).all()
  if (cars.length === 0) {
    console.warn('[RelocationsSeeder] No cars with a host_profile_id found — run DrivlySeeder first.')
    db.close()
    return
  }

  // Wipe existing demo rows so re-running is idempotent.
  db.exec(`DELETE FROM relocations WHERE notes LIKE '[demo] %'`)

  const COLS = 'car_id, host_profile_id, pickup_address, dropoff_address, earliest_pickup_date, latest_dropoff_date, estimated_distance_miles, compensation_type, flat_fee, per_mile_rate, fuel_allowance, max_extra_days, min_age, license_required, status, notes, uuid, created_at'
  const PLACEHOLDERS = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 21, 1, \'open\', ?, ?, CURRENT_TIMESTAMP'
  const insert = db.prepare(`INSERT INTO relocations (${COLS}) VALUES (${PLACEHOLDERS})`)

  const today = new Date()
  const day = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  const samples = [
    {
      pickup: 'Avis SFO, 780 N McDonnell Rd, San Francisco, CA',
      dropoff: 'Avis LAX, 9020 Aviation Blvd, Los Angeles, CA',
      miles: 380, type: 'flat', flat: 250, perMile: 0, fuel: 80, extra: 1,
      notes: '[demo] Need this Tesla in LA by Wednesday. Charging stops on the route are well covered.',
    },
    {
      pickup: 'Hertz JFK Terminal 1 Hub, Jamaica, NY',
      dropoff: 'Hertz Boston Logan Hub, East Boston, MA',
      miles: 215, type: 'per_mile', flat: 0, perMile: 0.55, fuel: 50, extra: 0,
      notes: '[demo] Quick city-to-city repositioning. Prefer experienced highway drivers.',
    },
    {
      pickup: 'Enterprise Denver DEN, Pena Blvd, Denver, CO',
      dropoff: 'Enterprise Aspen Pitkin County Airport, Aspen, CO',
      miles: 220, type: 'free', flat: 0, perMile: 0, fuel: 100, extra: 3,
      notes: '[demo] Free use of the SUV plus three extra days in Aspen — perfect for ski week.',
    },
    {
      pickup: 'Turo lot, Austin Bergstrom Airport, Austin, TX',
      dropoff: 'Turo lot, Dallas Love Field, Dallas, TX',
      miles: 195, type: 'flat', flat: 175, perMile: 0, fuel: 60, extra: 1,
      notes: '[demo] One-way I-35 run. Easy daylight drive.',
    },
    {
      pickup: 'Sixt Chicago O’Hare, Chicago, IL',
      dropoff: 'Sixt Detroit Metro, Romulus, MI',
      miles: 290, type: 'per_mile', flat: 0, perMile: 0.45, fuel: 70, extra: 0,
      notes: '[demo] Great for cross-state weekenders. We handle insurance.',
    },
    {
      pickup: 'Avis Las Vegas Strip, Las Vegas, NV',
      dropoff: 'Avis Phoenix Sky Harbor, Phoenix, AZ',
      miles: 300, type: 'flat', flat: 220, perMile: 0, fuel: 90, extra: 2,
      notes: '[demo] Beautiful desert drive. Stop at Hoover Dam if you have time.',
    },
  ]

  let i = 0
  for (const s of samples) {
    const car = cars[i % cars.length]
    insert.run(
      car.id, car.host_profile_id,
      s.pickup, s.dropoff,
      day(2 + i), day(8 + i),
      s.miles, s.type, s.flat, s.perMile, s.fuel, s.extra,
      s.notes, crypto.randomUUID(),
    )
    i += 1
  }

  console.log(`[RelocationsSeeder] Seeded ${samples.length} demo relocation postings.`)
}

run()
db.close()
