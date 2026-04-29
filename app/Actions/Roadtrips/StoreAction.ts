import { extractCity, snapshotLegFromRelocation } from './_helpers'

/**
 * Create a new roadtrip plan owned by the authed user.
 *
 * Optionally accepts a `legs` array — each entry is a relocation_id the
 * user has already chosen via the planner. The relocation's pickup,
 * dropoff, dates and pricing are snapshotted onto the leg (see
 * _helpers.ts:snapshotLegFromRelocation) so the plan stays stable
 * even if the relocation is edited afterwards.
 */
export default new Action({
  name: 'RoadtripsStoreAction',
  description: 'Create a new roadtrip plan',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const title = String(request.get('title') ?? '').trim()
    const originAddress = String(request.get('origin_address') ?? '').trim()
    const destinationAddress = String(request.get('destination_address') ?? '').trim()
    const earliest = String(request.get('earliest_start_date') ?? '')
    const latest = String(request.get('latest_end_date') ?? '')

    if (!originAddress || !destinationAddress)
      return response.badRequest('origin_address and destination_address are required')
    if (!earliest || !latest)
      return response.badRequest('earliest_start_date and latest_end_date are required')
    if (latest < earliest)
      return response.badRequest('latest_end_date cannot be before earliest_start_date')

    const originCity = String(request.get('origin_city') ?? '').trim() || extractCity(originAddress)
    const destinationCity = String(request.get('destination_city') ?? '').trim() || extractCity(destinationAddress)

    // Optional pre-picked relocation IDs from the planner. Validated below
    // before we persist the trip, so a bad chain rejects the whole create
    // instead of leaving an empty trip behind.
    const legsInput = (request.get('legs') as any[] | undefined) ?? []
    const relocIds = Array.isArray(legsInput)
      ? legsInput.map(l => Number(typeof l === 'object' ? l?.relocation_id : l)).filter(Boolean)
      : []

    let totalMiles = 0
    let stagedLegs: any[] = []

    if (relocIds.length > 0) {
      const relocs = toAttrs<any[]>(await Relocation.query().whereIn('id', relocIds).get())
      const relocById = new Map<number, any>()
      for (const r of relocs) relocById.set(Number(r.id), r)
      // Order legs by the input array so the user's picked sequence is preserved.
      const ordered = relocIds.map(id => relocById.get(id)).filter(Boolean)
      if (ordered.length !== relocIds.length)
        return response.badRequest('One or more selected relocations not found')

      for (const r of ordered) {
        if (r.status !== 'open')
          return response.badRequest(`Relocation #${r.id} is no longer open`)
      }

      stagedLegs = ordered.map((r, i) => ({
        sequence: i,
        relocation_id: Number(r.id),
        status: 'planned',
        ...snapshotLegFromRelocation(r),
      }))
      totalMiles = stagedLegs.reduce((s, l) => s + Number(l.estimated_distance_miles ?? 0), 0)
    }

    const trip = toAttrs<any>(await Roadtrip.create({
      user_id: Number(userId),
      title: title || `${originCity || 'Origin'} → ${destinationCity || 'Destination'}`,
      origin_address: originAddress,
      origin_city: originCity,
      destination_address: destinationAddress,
      destination_city: destinationCity,
      earliest_start_date: earliest,
      latest_end_date: latest,
      total_estimated_miles: totalMiles || Number(request.get('total_estimated_miles') ?? 0),
      status: 'planning',
      notes: String(request.get('notes') ?? ''),
    }))

    for (const leg of stagedLegs) {
      await RoadtripLeg.create({ ...leg, roadtrip_id: Number(trip.id) })
    }

    dispatch('roadtrip:created', trip)
    return response.json({ data: { ...trip, leg_count: stagedLegs.length } })
  },
})
