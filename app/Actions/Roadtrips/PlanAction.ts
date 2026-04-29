/**
 * Discover candidate chains of open relocations that, stitched together,
 * cover a user's desired roadtrip.
 *
 * Input: ?from=Los+Angeles&to=New+York&earliest=2026-05-01&latest=2026-05-30
 *
 * Strategy:
 *   1. Pull every open relocation whose pickup window overlaps the user's
 *      [earliest, latest] range.
 *   2. Index by normalized pickup_city.
 *   3. DFS from origin to destination, max depth MAX_DEPTH legs. Between
 *      legs we enforce a real schedule: the next leg's earliest_pickup_date
 *      must be on or after the prior leg's earliest_pickup_date plus the
 *      prior leg's estimated drive time (see _helpers.ts:earliestNextPickup).
 *      The final leg's latest_dropoff_date must also fit inside the user's
 *      `[earliest, latest]` window — chains that would land past the user's
 *      deadline are dropped instead of being shown as "you might make it."
 *   4. Score each chain (more pay > shorter total miles > fewer legs as a
 *      soft tiebreaker) and return the top N.
 *
 * The matcher is intentionally a substring match on the city name —
 * addresses are user-typed strings ("123 Main St, Los Angeles, CA") so
 * we extract the "city" component and compare lowercased. Direct chains
 * (LA → NYC, no stops) sort to the top when present.
 */

import { computePay, earliestNextPickup, extractCity, normCity } from './_helpers'

const MAX_DEPTH = 4
const MAX_RESULTS = 10

interface Leg {
  id: number
  pickup_address: string
  dropoff_address: string
  pickup_city: string
  dropoff_city: string
  earliest_pickup_date: string
  latest_dropoff_date: string
  estimated_distance_miles: number
  flat_fee: number
  per_mile_rate: number
  fuel_allowance: number
  max_extra_days: number
  compensation_type: string
  car_id: number | null
}

interface Chain {
  legs: Leg[]
  totalMiles: number
  totalPay: number
  earliestStart: string
  latestEnd: string
}

/**
 * Soft ranking score. Drivers don't see this number — it just orders the
 * results list. Higher is better. We weight pay heaviest, deduct a tiny
 * per-mile cost (longer trips at the same pay are less attractive), and
 * apply a small leg-count tiebreaker because more handovers mean more
 * paperwork even if the dollars line up.
 *
 * No platform-side pay bonus is baked in — total_pay shown to the driver
 * is exactly the sum of what each host posted. (See the design discussion
 * with the product owner: pay = whatever the host is willing to pay.)
 */
function chainScore(c: Chain): number {
  const tiebreaker = (c.legs.length - 1) * 5
  return c.totalPay - c.totalMiles * 0.05 - tiebreaker
}

export default new Action({
  name: 'RoadtripsPlanAction',
  description: 'Find candidate relocation chains for a roadtrip',
  method: 'GET',

  async handle(request: RequestInstance) {
    const fromCity = normCity(String(request.get('from') ?? ''))
    const toCity = normCity(String(request.get('to') ?? ''))
    const earliest = String(request.get('earliest') ?? '')
    const latest = String(request.get('latest') ?? '')

    if (!fromCity || !toCity)
      return response.badRequest('from and to are required')
    if (!earliest || !latest)
      return response.badRequest('earliest and latest dates are required')
    if (latest < earliest)
      return response.badRequest('latest cannot be before earliest')

    // Pull only open relocations whose window overlaps the user's window.
    // We do the date overlap on the date strings (ISO YYYY-MM-DD) — that's
    // a straight string compare since the format is lexicographically sorted.
    const raw = toAttrs<any[]>(await Relocation.query()
      .where('status', 'open')
      .where('earliest_pickup_date', '<=', latest)
      .where('latest_dropoff_date', '>=', earliest)
      .get())

    const legs: Leg[] = raw.map(r => ({
      id: Number(r.id),
      pickup_address: String(r.pickup_address ?? ''),
      dropoff_address: String(r.dropoff_address ?? ''),
      pickup_city: extractCity(r.pickup_address),
      dropoff_city: extractCity(r.dropoff_address),
      earliest_pickup_date: String(r.earliest_pickup_date ?? ''),
      latest_dropoff_date: String(r.latest_dropoff_date ?? ''),
      estimated_distance_miles: Number(r.estimated_distance_miles ?? 0),
      flat_fee: Number(r.flat_fee ?? 0),
      per_mile_rate: Number(r.per_mile_rate ?? 0),
      fuel_allowance: Number(r.fuel_allowance ?? 0),
      max_extra_days: Number(r.max_extra_days ?? 0),
      compensation_type: String(r.compensation_type ?? ''),
      car_id: r.car_id ? Number(r.car_id) : null,
    }))

    // Adjacency map: pickup city → outbound legs
    const byPickup = new Map<string, Leg[]>()
    for (const leg of legs) {
      if (!leg.pickup_city) continue
      const arr = byPickup.get(leg.pickup_city)
      if (arr) arr.push(leg)
      else byPickup.set(leg.pickup_city, [leg])
    }

    const chains: Chain[] = []
    const visited = new Set<number>()

    function dfs(currentCity: string, soFar: Leg[], earliestNext: string) {
      if (soFar.length > MAX_DEPTH) return
      if (soFar.length > 0 && currentCity === toCity) {
        const last = soFar[soFar.length - 1]
        // Reject chains whose last leg can run past the user's hard deadline —
        // a chain that "might just barely make it" is worse UX than not
        // showing it at all (driver thinks they can book and then can't).
        if (last.latest_dropoff_date && latest && last.latest_dropoff_date > latest)
          return
        const totalMiles = soFar.reduce((s, l) => s + l.estimated_distance_miles, 0)
        const totalPay = soFar.reduce((s, l) => s + computePay(l), 0)
        chains.push({
          legs: [...soFar],
          totalMiles,
          totalPay,
          earliestStart: soFar[0].earliest_pickup_date,
          latestEnd: last.latest_dropoff_date,
        })
        return
      }
      const candidates = byPickup.get(currentCity) ?? []
      for (const next of candidates) {
        if (visited.has(next.id)) continue
        // Schedule feasibility — the next leg's earliest pickup must be on or
        // after when we'd realistically arrive. Without this check the planner
        // would suggest "drive 1500 mi today, pick up the next car tomorrow."
        if (earliestNext && next.earliest_pickup_date < earliestNext) continue
        // The next leg also has to dropoff inside the user's window — pruning
        // here saves recursing into chains we'd reject at the leaf anyway.
        if (latest && next.latest_dropoff_date > latest && next.dropoff_city === toCity) continue
        visited.add(next.id)
        soFar.push(next)
        dfs(next.dropoff_city, soFar, earliestNextPickup(next.earliest_pickup_date, next.estimated_distance_miles))
        soFar.pop()
        visited.delete(next.id)
      }
    }

    dfs(fromCity, [], earliest)

    const ranked = chains
      .map(c => ({ chain: c, score: chainScore(c) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)

    // Pull car snapshots for the legs we're returning (compact display in UI).
    const carIds = [...new Set(ranked.flatMap(({ chain }) => chain.legs.map(l => l.car_id)).filter(Boolean) as number[])]
    const cars = carIds.length ? toAttrs<any[]>(await Car.query().whereIn('id', carIds).get()) : []
    const carById = new Map<number, any>()
    for (const c of cars) carById.set(Number(c.id), c)

    const data = ranked.map(({ chain, score }) => ({
      legs: chain.legs.map(l => ({
        relocation_id: l.id,
        pickup_address: l.pickup_address,
        dropoff_address: l.dropoff_address,
        pickup_city: l.pickup_city,
        dropoff_city: l.dropoff_city,
        earliest_pickup_date: l.earliest_pickup_date,
        latest_dropoff_date: l.latest_dropoff_date,
        estimated_distance_miles: l.estimated_distance_miles,
        compensation_type: l.compensation_type,
        flat_fee: l.flat_fee,
        per_mile_rate: l.per_mile_rate,
        fuel_allowance: l.fuel_allowance,
        max_extra_days: l.max_extra_days,
        estimated_pay: computePay(l),
        car: l.car_id ? carById.get(l.car_id) ?? null : null,
      })),
      stops: [
        chain.legs[0].pickup_city,
        ...chain.legs.map(l => l.dropoff_city),
      ],
      total_miles: chain.totalMiles,
      total_pay: chain.totalPay,
      // Sum of bonus free days across legs — surfaced as a value indicator
      // ("+5 free days") in the UI, not folded into total_pay.
      total_extra_days: chain.legs.reduce((s, l) => s + Number(l.max_extra_days ?? 0), 0),
      leg_count: chain.legs.length,
      earliest_start: chain.earliestStart,
      latest_end: chain.latestEnd,
      score,
    }))

    return response.json({
      data,
      meta: {
        from: fromCity,
        to: toCity,
        earliest,
        latest,
        candidates_scanned: legs.length,
      },
    })
  },
})
