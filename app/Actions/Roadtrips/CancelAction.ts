import { withdrawApplication } from './_legSync'

/**
 * Cancel a roadtrip. Allowed while not yet completed.
 *
 * Cancelling fans out: each leg's underlying relocation application is
 * withdrawn (so hosts don't keep waiting on you and approved relocations
 * revert to `open` for someone else to claim). Legs flip to `cancelled`
 * inside withdrawApplication via the leg-sync helper.
 */

const CANCELABLE = new Set(['planning', 'confirmed', 'in_progress'])

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

    // Walk each leg and withdraw the linked application. The leg-sync helper
    // also flips the leg's status to 'cancelled' for legs we successfully
    // withdrew. We collect per-leg results so the caller can see which
    // applications were live (vs already terminal).
    const legs = toAttrs<any[]>(await RoadtripLeg.query().where('roadtrip_id', id).get())
    const withdrawResults: any[] = []
    for (const leg of legs) {
      if (!leg.relocation_id) continue
      const w = await withdrawApplication({
        relocationId: Number(leg.relocation_id),
        userId: Number(userId),
      })
      withdrawResults.push({ leg_id: Number(leg.id), ok: w.ok, reason: w.reason })
    }

    // Mark every still-live leg as cancelled — covers legs that didn't have an
    // application yet (status === 'planned'), which withdrawApplication wouldn't
    // touch.
    try {
      await db.updateTable('roadtrip_legs')
        .set({ status: 'cancelled', updated_at: new Date().toISOString() })
        .where('roadtrip_id', '=', id)
        .where('status', 'in', ['planned', 'applied', 'approved'])
        .execute()
    }
    catch { /* non-fatal */ }

    dispatch('roadtrip:cancelled', updated)
    return response.json({ data: updated, withdrawals: withdrawResults })
  },
})
