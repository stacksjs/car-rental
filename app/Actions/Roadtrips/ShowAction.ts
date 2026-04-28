/**
 * Single roadtrip with all of its legs hydrated with the underlying
 * relocation data. Auth-gated to the trip's owner.
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

    // Hydrate each leg with its relocation + car. Also pull the user's own
    // application status for the relocation so the trip view can show whether
    // they've already applied / been approved / etc.
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
      return { ...l, relocation: reloc ? { ...reloc, car } : null, my_application: myApp }
    })

    const stops = hydratedLegs.length
      ? [hydratedLegs[0].from_city, ...hydratedLegs.map(l => l.to_city)]
      : [trip.origin_city, trip.destination_city]

    const total_pay = hydratedLegs.reduce((s, l) => {
      const r = l.relocation
      if (!r) return s
      if (r.compensation_type === 'flat') return s + Number(r.flat_fee || 0) + Number(r.fuel_allowance || 0)
      if (r.compensation_type === 'per_mile')
        return s + Math.round(Number(r.per_mile_rate || 0) * Number(r.estimated_distance_miles || 0)) + Number(r.fuel_allowance || 0)
      return s + Number(r.fuel_allowance || 0)
    }, 0)

    const total_miles = hydratedLegs.reduce((s, l) => s + Number(l.estimated_distance_miles || 0), 0)

    return response.json({
      data: {
        ...trip,
        legs: hydratedLegs,
        stops,
        leg_count: hydratedLegs.length,
        total_pay,
        total_miles,
      },
    })
  },
})
