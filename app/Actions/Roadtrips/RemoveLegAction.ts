/**
 * Drop a leg off the roadtrip and re-pack the sequence numbers so the
 * remaining legs stay 0..N-1. Doesn't touch the underlying relocation
 * application — drivers withdraw those through the relocation UI.
 */

export default new Action({
  name: 'RoadtripsRemoveLegAction',
  description: 'Remove a leg from a roadtrip',
  method: 'DELETE',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const tripId = Number((request as any).params?.id)
    const legId = Number((request as any).params?.legId)
    if (!tripId || !legId) return response.badRequest('id and legId required')

    const trip = toAttrs<any>(await Roadtrip.find(tripId))
    if (!trip) return response.notFound('Roadtrip not found')
    if (Number(trip.user_id) !== Number(userId))
      return response.forbidden('Not your roadtrip')
    if (trip.status === 'completed' || trip.status === 'cancelled')
      return response.badRequest(`Cannot edit a roadtrip with status "${trip.status}"`)

    const leg = toAttrs<any>(await RoadtripLeg.find(legId))
    if (!leg || Number(leg.roadtrip_id) !== tripId)
      return response.notFound('Leg not found on this roadtrip')

    await RoadtripLeg.delete(legId)

    // Re-pack the sequence column so legs stay contiguous 0..N-1.
    const remaining = toAttrs<any[]>(await RoadtripLeg.query()
      .where('roadtrip_id', tripId)
      .orderBy('sequence', 'asc')
      .get())
    for (let i = 0; i < remaining.length; i++) {
      if (Number(remaining[i].sequence) !== i)
        await RoadtripLeg.update(remaining[i].id, { sequence: i })
    }

    const totalMiles = remaining.reduce((s, l) => s + Number(l.estimated_distance_miles ?? 0), 0)
    await Roadtrip.update(tripId, { total_estimated_miles: totalMiles })

    return response.json({ data: { removed: legId, remaining: remaining.length } })
  },
})
