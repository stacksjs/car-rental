/**
 * Add a relocation as a new leg of the roadtrip.
 *
 * The leg is appended to the end (sequence = max + 1) unless the caller
 * specifies an explicit position. The trip's total_estimated_miles is
 * recomputed after the leg lands.
 */

function extractCity(address: string | null | undefined): string {
  const parts = String(address ?? '').split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 3) return parts[parts.length - 2].toLowerCase()
  if (parts.length === 2) return parts[0].toLowerCase()
  return String(parts[0] ?? '').toLowerCase()
}

export default new Action({
  name: 'RoadtripsAddLegAction',
  description: 'Append a relocation as a new leg of a roadtrip',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const tripId = Number((request as any).params?.id)
    if (!tripId) return response.badRequest('id required')

    const trip = toAttrs<any>(await Roadtrip.find(tripId))
    if (!trip) return response.notFound('Roadtrip not found')
    if (Number(trip.user_id) !== Number(userId))
      return response.forbidden('Not your roadtrip')
    if (trip.status === 'completed' || trip.status === 'cancelled')
      return response.badRequest(`Cannot edit a roadtrip with status "${trip.status}"`)

    const relocId = Number(request.get('relocation_id'))
    if (!relocId) return response.badRequest('relocation_id is required')

    const reloc = toAttrs<any>(await Relocation.find(relocId))
    if (!reloc) return response.notFound('Relocation not found')
    if (reloc.status !== 'open')
      return response.badRequest('Relocation is not open')

    const existing = toAttrs<any[]>(await RoadtripLeg.query().where('roadtrip_id', tripId).orderBy('sequence', 'asc').get())
    if (existing.some(l => Number(l.relocation_id) === relocId))
      return response.badRequest('That relocation is already on this trip')

    const nextSeq = existing.length > 0
      ? Math.max(...existing.map(l => Number(l.sequence))) + 1
      : 0

    const leg = toAttrs<any>(await RoadtripLeg.create({
      roadtrip_id: tripId,
      relocation_id: relocId,
      sequence: nextSeq,
      from_address: reloc.pickup_address,
      from_city: extractCity(reloc.pickup_address),
      to_address: reloc.dropoff_address,
      to_city: extractCity(reloc.dropoff_address),
      estimated_distance_miles: Number(reloc.estimated_distance_miles ?? 0),
      status: 'planned',
    }))

    // Recompute the trip's total mileage so the index/show summaries stay correct.
    const totalMiles = [...existing.map(l => Number(l.estimated_distance_miles ?? 0)), Number(reloc.estimated_distance_miles ?? 0)]
      .reduce((s, n) => s + n, 0)
    await Roadtrip.update(tripId, { total_estimated_miles: totalMiles })

    dispatch('roadtrip:leg:added', leg)
    return response.json({ data: leg })
  },
})
