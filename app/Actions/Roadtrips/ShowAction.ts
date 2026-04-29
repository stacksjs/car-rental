import { computePay } from './_helpers'

/**
 * Single roadtrip with all of its legs hydrated with the underlying
 * relocation data. Auth-gated to the trip's owner.
 *
 * The leg's pricing snapshot (from add-time) is the source of truth for
 * `estimated_pay` and `total_pay` — re-pulling from the live relocation
 * row would let a host's edit silently change the displayed deal.
 * The relocation is still hydrated for current-state info (status,
 * driver, odometer) and so the UI can show the car details.
 */
export default new Action({
  name: 'RoadtripsShowAction',
  description: 'Single roadtrip with hydrated legs',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('id required')

    const trip = toAttrs<any>(await Roadtrip.find(id))
    if (!trip) return response.notFound('Roadtrip not found')
    if (Number(trip.user_id) !== Number(userId))
      return response.forbidden('Not your roadtrip')

    const legs = toAttrs<any[]>(await RoadtripLeg.query()
      .where('roadtrip_id', id)
      .orderBy('sequence', 'asc')
      .get())

    const relocIds = [...new Set(legs.map(l => Number(l.relocation_id)).filter(Boolean))]
    const relocs = relocIds.length
      ? toAttrs<any[]>(await Relocation.query().whereIn('id', relocIds).get())
      : []
    const relocById = new Map<number, any>()
    for (const r of relocs) relocById.set(Number(r.id), r)

    const carIds = [...new Set(relocs.map(r => Number(r.car_id)).filter(Boolean))]
    const cars = carIds.length ? toAttrs<any[]>(await Car.query().whereIn('id', carIds).get()) : []
    const carById = new Map<number, any>()
    for (const c of cars) carById.set(Number(c.id), c)

    // Pull the user's own application status for each relocation so the trip
    // view can show "applied / approved / rejected" alongside each leg.
    const myApps = relocIds.length
      ? toAttrs<any[]>(await RelocationApplication.query()
          .whereIn('relocation_id', relocIds)
          .where('user_id', userId)
          .get())
      : []
    const myAppByRelocId = new Map<number, any>()
    for (const a of myApps) myAppByRelocId.set(Number(a.relocation_id), a)

    const hydratedLegs = legs.map(l => {
      const reloc = relocById.get(Number(l.relocation_id)) ?? null
      const car = reloc?.car_id ? carById.get(Number(reloc.car_id)) ?? null : null
      const myApp = myAppByRelocId.get(Number(l.relocation_id)) ?? null
      // estimated_pay uses the snapshot when present (newer legs), falls back
      // to the live relocation's pricing for legs that predate the snapshot
      // migration.
      const estimated_pay = Number(l.estimated_pay ?? 0) || (reloc ? computePay(reloc) : 0)
      return {
        ...l,
        estimated_pay,
        relocation: reloc ? { ...reloc, car } : null,
        my_application: myApp,
      }
    })

    const stops = hydratedLegs.length
      ? [hydratedLegs[0].from_city, ...hydratedLegs.map(l => l.to_city)]
      : [trip.origin_city, trip.destination_city]

    const total_pay = hydratedLegs.reduce((s, l) => s + Number(l.estimated_pay ?? 0), 0)
    const total_miles = hydratedLegs.reduce((s, l) => s + Number(l.estimated_distance_miles ?? 0), 0)
    const total_extra_days = hydratedLegs.reduce((s, l) => s + Number(l.max_extra_days ?? 0), 0)

    return response.json({
      data: {
        ...trip,
        legs: hydratedLegs,
        stops,
        leg_count: hydratedLegs.length,
        total_pay,
        total_miles,
        total_extra_days,
      },
    })
  },
})
