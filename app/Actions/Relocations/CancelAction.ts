import { syncAllLegsForRelocation } from '../Roadtrips/_legSync'

/**
 * Host cancels their own posting. Allowed only while the relocation hasn't
 * been picked up yet (`open` or `claimed`). Once the driver is en route
 * (`in_progress`) or it's `completed`, cancellation goes through support.
 *
 * Side effects:
 *   - Any pending applications for this relocation are auto-rejected so
 *     drivers see a clear final status instead of a dangling "pending".
 *   - Every roadtrip leg pointing at this relocation is mirrored to
 *     `cancelled` (across every driver's trips, not just one) so trip
 *     views don't show stale "applied"/"approved" pills.
 */

const CANCELABLE = new Set(['open', 'claimed'])

export default new Action({
  name: 'RelocationsCancelAction',
  description: 'Host cancels a relocation posting',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('id required')

    const reloc = toAttrs<any>(await Relocation.find(id))
    if (!reloc) return response.notFound('Relocation not found')

    const hostProfile = toAttrs<any>(await HostProfile.find(reloc.host_profile_id))
    if (!hostProfile || Number(hostProfile.user_id) !== Number(userId))
      return response.forbidden('Not your relocation')

    if (!CANCELABLE.has(String(reloc.status)))
      return response.badRequest(`Cannot cancel a relocation with status "${reloc.status}"`)

    const updated = toAttrs<any>(await Relocation.update(id, { status: 'cancelled' }))

    // Best-effort: reject all dangling applications. Driver UIs should poll
    // /api/relocations/mine/driver to refresh, so a missed update here is
    // a UX paper-cut, not a data integrity issue.
    try {
      await db.updateTable('relocation_applications')
        .set({ status: 'rejected', rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .where('relocation_id', '=', id)
        .where('status', '=', 'pending')
        .execute()
    }
    catch { /* non-fatal */ }

    await syncAllLegsForRelocation({ relocationId: id, legStatus: 'cancelled' })

    dispatch('relocation:cancelled', updated)
    return response.json({ data: updated })
  },
})
