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
 *   3. DFS from origin to destination, max depth 4 legs, time-ordering each
 *      next leg's earliest_pickup_date >= the previous leg's earliest pickup.
 *   4. Score each chain (fewer legs > more pay > shorter total miles) and
 *      return the top N.
 *
 * The matcher is intentionally a substring match on the city name — addresses
 * are user-typed strings ("123 Main St, Los Angeles, CA") so we extract the
 * "city" component and compare lowercased. Direct chains (LA → NYC, no stops)
 * are always returned first when present.
 */

const MAX_DEPTH = 4
const MAX_RESULTS = 10

function normCity(s: string | null | undefined): string {
  return String(s ?? '').trim().toLowerCase()
}

// Address shape we expect: "123 Street, City, ST" or "City, ST" — pull the
// "City" segment. If it doesn't parse, fall back to the whole string lowered.
function extractCity(address: string | null | undefined): string {
  const parts = String(address ?? '').split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 3) return normCity(parts[parts.length - 2])
  if (parts.length === 2) return normCity(parts[0])
  return normCity(parts[0] ?? '')
}

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

function chainScore(c: Chain): number {
  // Fewer legs win on tie-break; each leg adds a "switching cost" of 50.
  // After that, more pay > shorter trip.
  const switchPenalty = (c.legs.length - 1) * 50
  return c.totalPay - switchPenalty - c.totalMiles * 0.05
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

    // Estimated payout for a single leg (before per-mile multiplier needs
    // actual_miles_driven, so we approximate using estimated_distance_miles).
    const legPay = (leg: Leg): number => {
      if (leg.compensation_type === 'flat') return leg.flat_fee + leg.fuel_allowance
      if (leg.compensation_type === 'per_mile')
        return Math.round(leg.per_mile_rate * leg.estimated_distance_miles) + leg.fuel_allowance
      return leg.fuel_allowance
    }

    const chains: Chain[] = []
    const visited = new Set<number>()

    // DFS — accumulate legs that match the chain rules.
    function dfs(currentCity: string, soFar: Leg[], lastDate: string) {
      if (soFar.length > MAX_DEPTH) return
      if (soFar.length > 0 && currentCity === toCity) {
        const totalMiles = soFar.reduce((s, l) => s + l.estimated_distance_miles, 0)
        const totalPay = soFar.reduce((s, l) => s + legPay(l), 0)
        chains.push({
          legs: [...soFar],
          totalMiles,
          totalPay,
          earliestStart: soFar[0].earliest_pickup_date,
          latestEnd: soFar[soFar.length - 1].latest_dropoff_date,
        })
        return
      }
      const candidates = byPickup.get(currentCity) ?? []
      for (const next of candidates) {
        if (visited.has(next.id)) continue
        // Time-order constraint — each subsequent leg starts no earlier than
        // the previous leg's earliest pickup. (Loose; doesn't enforce that
        // prior leg's dropoff window precedes the next leg.)
        if (lastDate && next.earliest_pickup_date < lastDate) continue
        visited.add(next.id)
        soFar.push(next)
        dfs(next.dropoff_city, soFar, next.earliest_pickup_date)
        soFar.pop()
        visited.delete(next.id)
      }
    }

    dfs(fromCity, [], earliest)

    // Score, dedupe by leg-id signature, take top N.
    const seen = new Set<string>()
    const ranked = chains
      .map(c => ({ chain: c, score: chainScore(c) }))
      .sort((a, b) => b.score - a.score)
      .filter(({ chain }) => {
        const key = chain.legs.map(l => l.id).join('-')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
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
        estimated_pay: legPay(l),
        car: l.car_id ? carById.get(l.car_id) ?? null : null,
      })),
      stops: [
        chain.legs[0].pickup_city,
        ...chain.legs.map(l => l.dropoff_city),
      ],
      total_miles: chain.totalMiles,
      total_pay: chain.totalPay,
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
