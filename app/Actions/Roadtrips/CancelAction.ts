/**
 * Cancel a roadtrip. Allowed while not yet completed. Cancelling does
 * NOT cancel the underlying relocation applications — those continue
 * on their own lifecycle (the user can withdraw via the relocation UI).
 */

const CANCELABLE = new Set(['planning', 'confirmed'])

export default new Action({
  name: 'RoadtripsCancelAction',
  description: 'Cancel a roadtrip plan',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('id required')

    const trip = toAttrs<any>(await Roadtrip.find(id))
    if (!trip) return response.notFound('Roadtrip not found')
    if (Number(trip.user_id) !== Number(userId))
      return response.forbidden('Not your roadtrip')
    if (!CANCELABLE.has(String(trip.status)))
      return response.badRequest(`Cannot cancel a roadtrip with status "${trip.status}"`)

    const updated = toAttrs<any>(await Roadtrip.update(id, { status: 'cancelled' }))

    // Mark every still-planned leg as cancelled too so the trip view doesn't
    // show stale "planned" pills under a cancelled trip.
    try {
      await db.updateTable('roadtrip_legs')
        .set({ status: 'cancelled', updated_at: new Date().toISOString() })
        .where('roadtrip_id', '=', id)
        .where('status', 'in', ['planned', 'applied'])
        .execute()
    }
    catch { /* non-fatal */ }

    dispatch('roadtrip:cancelled', updated)
    return response.json({ data: updated })
  },
})
