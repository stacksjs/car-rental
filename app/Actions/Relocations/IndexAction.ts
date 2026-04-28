/**
 * Public catalog of open relocation jobs. Drivers browse here.
 *
 * Filters: ?from=City&to=City (substring match on the address fields),
 * ?compensation=flat|per_mile|free, ?minPay=N (per-trip minimum, computed
 * vs estimated distance for per-mile), ?status=open|claimed (defaults to
 * open). Pagination via ?limit + ?offset, sort via ?sort.
 */

const SORT_MAP: Record<string, [string, 'asc' | 'desc']> = {
  newest: ['created_at', 'desc'],
  payHigh: ['flat_fee', 'desc'],
  payLow: ['flat_fee', 'asc'],
  soonest: ['earliest_pickup_date', 'asc'],
}

export default new Action({
  name: 'RelocationsIndexAction',
  description: 'Browse open relocation postings',
  method: 'GET',

  async handle(request: RequestInstance) {
    const fromCity = String(request.get('from') ?? '').trim()
    const toCity = String(request.get('to') ?? '').trim()
    const compensation = request.get('compensation') as string | undefined
    const status = String(request.get('status') ?? 'open')
    const minPay = request.get('minPay') ? Number(request.get('minPay')) : undefined
    const sort = String(request.get('sort') ?? 'newest')
    const limit = Math.min(Number(request.get('limit') ?? 24), 96)
    const offset = Number(request.get('offset') ?? 0)

    let qb = Relocation.query().where('status', status)

    if (fromCity) qb = qb.where('pickup_address', 'like', `%${fromCity}%`)
    if (toCity) qb = qb.where('dropoff_address', 'like', `%${toCity}%`)
    if (compensation) qb = qb.where('compensation_type', compensation)
    if (minPay != null) qb = qb.where('flat_fee', '>=', minPay)

    const [sortCol, sortDir] = SORT_MAP[sort] ?? SORT_MAP.newest
    qb = qb.orderBy(sortCol, sortDir)

    const total = await Relocation.query().where('status', status).count()
    const rows = toAttrs<any[]>(await qb.limit(limit).offset(offset).get())

    // Hydrate each row with a compact car snapshot so the browse UI can
    // render the make/model/photo without a second client round-trip.
    const carIds = [...new Set(rows.map(r => Number(r.car_id)).filter(Boolean))]
    const cars = carIds.length ? toAttrs<any[]>(await Car.query().whereIn('id', carIds).get()) : []
    const carById = new Map<number, any>()
    for (const c of cars) carById.set(Number(c.id), c)

    const data = rows.map(r => ({ ...r, car: carById.get(Number(r.car_id)) ?? null }))

    return response.json({ data, meta: { total, limit, offset } })
  },
})
