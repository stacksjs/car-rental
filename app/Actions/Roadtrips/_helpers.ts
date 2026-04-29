/**
 * Pure helpers shared across roadtrip + relocation actions.
 *
 * Kept dependency-free (no model imports, no DB calls) so:
 *   - callers stay in control of the I/O,
 *   - the helpers can be unit-tested without spinning up SQLite,
 *   - the same logic is reused by Plan / Store / AddLeg / Show / sync paths
 *     without drift.
 */

export function normCity(s: string | null | undefined): string {
  return String(s ?? '').trim().toLowerCase()
}

/**
 * Address shape we expect: "123 Street, City, ST" or "City, ST" — pull the
 * "City" segment. Falls back to the whole string lowered if it doesn't
 * parse. Brittle on international / ZIP-included addresses; good enough
 * for the planner's substring-matched chains.
 */
export function extractCity(address: string | null | undefined): string {
  const parts = String(address ?? '').split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 3) return normCity(parts[parts.length - 2])
  if (parts.length === 2) return normCity(parts[0])
  return normCity(parts[0] ?? '')
}

export interface PayInputs {
  compensation_type?: string | null
  flat_fee?: number | null
  per_mile_rate?: number | null
  fuel_allowance?: number | null
  estimated_distance_miles?: number | null
  actual_miles_driven?: number | null
}

/**
 * Compute payout for a relocation leg.
 *
 *   - flat:     flat_fee + fuel_allowance
 *   - per_mile: round(per_mile_rate * miles) + fuel_allowance
 *               (uses actual miles when available, falls back to the
 *               estimated distance for pre-completion previews)
 *   - free / unknown: just the fuel_allowance — the perk *is* the free use
 *                     of the car, so the pay is only out-of-pocket recovery.
 *
 * Mirrors the formula in RelocationsCompleteAction so a planner estimate
 * lines up with the eventual settled payout when distance is exact.
 */
export function computePay(input: PayInputs): number {
  const fuel = Number(input.fuel_allowance ?? 0)
  const type = String(input.compensation_type ?? '')
  if (type === 'flat')
    return Number(input.flat_fee ?? 0) + fuel
  if (type === 'per_mile') {
    const miles = Number(input.actual_miles_driven ?? input.estimated_distance_miles ?? 0)
    return Math.round(Number(input.per_mile_rate ?? 0) * miles) + fuel
  }
  return fuel
}

export interface LegSnapshotInput {
  pickup_address?: string | null
  dropoff_address?: string | null
  earliest_pickup_date?: string | null
  latest_dropoff_date?: string | null
  estimated_distance_miles?: number | null
  compensation_type?: string | null
  flat_fee?: number | null
  per_mile_rate?: number | null
  fuel_allowance?: number | null
  max_extra_days?: number | null
}

export interface LegSnapshot {
  from_address: string
  from_city: string
  to_address: string
  to_city: string
  earliest_pickup_date: string
  latest_dropoff_date: string
  estimated_distance_miles: number
  compensation_type: string
  flat_fee: number
  per_mile_rate: number
  fuel_allowance: number
  max_extra_days: number
  estimated_pay: number
}

/**
 * Snapshot the relocation fields that drive a leg's identity + payout.
 *
 * Stored on roadtrip_legs at add-time so the deal the user signed up for
 * doesn't shift if the host later edits the relocation (e.g. lowers the
 * flat_fee or changes the dropoff address). The trip's totals stay honest
 * to what the user agreed to, and any host change just means new chains
 * the planner builds *next* will reflect the new posting.
 */
export function snapshotLegFromRelocation(reloc: LegSnapshotInput): LegSnapshot {
  const from_address = String(reloc.pickup_address ?? '')
  const to_address = String(reloc.dropoff_address ?? '')
  const compensation_type = String(reloc.compensation_type ?? '')
  const flat_fee = Number(reloc.flat_fee ?? 0)
  const per_mile_rate = Number(reloc.per_mile_rate ?? 0)
  const fuel_allowance = Number(reloc.fuel_allowance ?? 0)
  const max_extra_days = Number(reloc.max_extra_days ?? 0)
  const estimated_distance_miles = Number(reloc.estimated_distance_miles ?? 0)
  const estimated_pay = computePay({
    compensation_type,
    flat_fee,
    per_mile_rate,
    fuel_allowance,
    estimated_distance_miles,
  })
  return {
    from_address,
    from_city: extractCity(from_address),
    to_address,
    to_city: extractCity(to_address),
    earliest_pickup_date: String(reloc.earliest_pickup_date ?? ''),
    latest_dropoff_date: String(reloc.latest_dropoff_date ?? ''),
    estimated_distance_miles,
    compensation_type,
    flat_fee,
    per_mile_rate,
    fuel_allowance,
    max_extra_days,
    estimated_pay,
  }
}

/**
 * Estimate how many days a relocation leg takes to drive given its mileage.
 *
 * Used by the planner to enforce that consecutive legs are physically
 * schedulable — i.e. you can't "drive 1500 miles then pick up a different
 * car the next morning". 500 mi/day is conservative; most one-way
 * driveaway programs assume ~400-500/day for unfamiliar drivers.
 */
export function estimateDriveDays(miles: number | null | undefined): number {
  const m = Math.max(0, Number(miles ?? 0))
  return Math.max(1, Math.ceil(m / 500))
}

/**
 * Add `days` to an ISO YYYY-MM-DD date and return ISO. Treats the date as
 * UTC midnight so DST / timezone shifts can't introduce off-by-one.
 */
export function addDaysISO(isoDate: string, days: number): string {
  if (!isoDate) return isoDate
  const d = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return isoDate
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Earliest date a follow-on leg can pick up after the previous leg picks up,
 * given the previous leg's distance. The planner uses this as the floor
 * for chain feasibility — the prior chain's pickup date plus its drive
 * time, rounded up to a day boundary.
 */
export function earliestNextPickup(prevEarliestPickup: string, prevMiles: number | null | undefined): string {
  return addDaysISO(prevEarliestPickup, estimateDriveDays(prevMiles))
}
