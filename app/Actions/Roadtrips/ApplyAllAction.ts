/**
 * One-shot apply-to-every-leg helper. The user already vetted each leg's
 * relocation when they added it via the planner; this saves them from
 * re-typing a message into N application forms.
 *
 * Applications go to `pending`. Each leg's status flips to `applied`.
 * The trip status moves planning → confirmed once at least one
 * application is submitted. Idempotent: re-running on a trip that's
 * already had its legs applied is a no-op.
 */

export default new Action({
  name: 'RoadtripsApplyAllAction',
  description: 'Apply to every relocation on the roadtrip in one shot',
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

    const message = String(request.get('message') ?? '').slice(0, 1000)

    const legs = toAttrs<any[]>(await RoadtripLeg.query()
      .where('roadtrip_id', tripId)
      .orderBy('sequence', 'asc')
      .get())
    if (legs.length === 0) return response.badRequest('Add at least one leg before applying')

    const results: any[] = []

    for (const leg of legs) {
      if (!leg.relocation_id) continue
      const reloc = toAttrs<any>(await Relocation.find(Number(leg.relocation_id)))
      if (!reloc || reloc.status !== 'open') continue

      // Don't let a user apply to drive their own posting (host_profile linked
      // to this user). Mirrors the guard in RelocationsApplyAction.
      const hostProfile = toAttrs<any>(await HostProfile.find(reloc.host_profile_id))
      if (hostProfile && Number(hostProfile.user_id) === Number(userId)) continue

      const existing = toAttrs<any>(await RelocationApplication.query()
        .where('relocation_id', Number(leg.relocation_id))
        .where('user_id', Number(userId))
        .first())

      let app: any
      if (existing) {
        if (existing.status === 'pending') {
          app = existing
        }
        else {
          app = toAttrs<any>(await RelocationApplication.update(existing.id, {
            status: 'pending',
            message: message || existing.message,
          }))
        }
      }
      else {
        app = toAttrs<any>(await RelocationApplication.create({
          relocation_id: Number(leg.relocation_id),
          user_id: Number(userId),
          status: 'pending',
          message,
        }))
      }

      await RoadtripLeg.update(leg.id, { status: 'applied' })
      results.push({ leg_id: leg.id, application: app })
    }

    if (results.length > 0 && trip.status === 'planning')
      await Roadtrip.update(tripId, { status: 'confirmed' })

    dispatch('roadtrip:applied', { trip, count: results.length })
    return response.json({ data: results, applied: results.length, total: legs.length })
  },
})
