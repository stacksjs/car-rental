/**
 * List the authed user's roadtrips, grouped by status. Returns light
 * summaries (title, stops, status, leg count) — full leg detail comes
 * via ShowAction so the list view stays cheap.
 */

export default new Action({
  name: 'RoadtripsIndexAction',
  description: 'List the authed user\'s roadtrips',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const trips = toAttrs<any[]>(await Roadtrip.query()
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .get())

    const tripIds = trips.map(t => Number(t.id))
    const legs = tripIds.length
      ? toAttrs<any[]>(await RoadtripLeg.query().whereIn('roadtrip_id', tripIds).orderBy('sequence', 'asc').get())
      : []
    const legsByTrip = new Map<number, any[]>()
    for (const l of legs) {
      const arr = legsByTrip.get(Number(l.roadtrip_id)) ?? []
      arr.push(l)
      legsByTrip.set(Number(l.roadtrip_id), arr)
    }

    const hydrated = trips.map(t => {
      const tLegs = legsByTrip.get(Number(t.id)) ?? []
      return {
        ...t,
        leg_count: tLegs.length,
        stops: tLegs.length
          ? [tLegs[0].from_city, ...tLegs.map(l => l.to_city)]
          : [t.origin_city, t.destination_city],
      }
    })

    const grouped = {
      planning: hydrated.filter(r => r.status === 'planning'),
      confirmed: hydrated.filter(r => r.status === 'confirmed'),
      in_progress: hydrated.filter(r => r.status === 'in_progress'),
      completed: hydrated.filter(r => r.status === 'completed'),
      cancelled: hydrated.filter(r => r.status === 'cancelled'),
    }

    return response.json({ ...grouped, total: hydrated.length })
  },
})
