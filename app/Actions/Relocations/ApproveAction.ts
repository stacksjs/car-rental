/**
 * Host approves one of the pending applications.
 *
 * Side effects (atomic in spirit, best-effort across the two tables):
 *   1. The chosen application's status flips to `approved` + approved_at stamped.
 *   2. The relocation transitions to `claimed` and `driver_id` is set.
 *   3. All other pending applications for this relocation are auto-rejected.
 *
 * Re-approving the same application is a no-op (idempotent on the happy path).
 */

export default new Action({
  name: 'RelocationsApproveAction',
  description: 'Host approves a driver application for a relocation',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const relocId = Number((request as any).params?.id)
    const appId = Number((request as any).params?.applicationId)
    if (!relocId || !appId) return response.badRequest('id and applicationId required')

    const reloc = toAttrs<any>(await Relocation.find(relocId))
    if (!reloc) return response.notFound('Relocation not found')

    const hostProfile = toAttrs<any>(await HostProfile.find(reloc.host_profile_id))
    if (!hostProfile || Number(hostProfile.user_id) !== Number(userId))
      return response.forbidden('Not your relocation')

    if (reloc.status !== 'open' && reloc.status !== 'claimed')
      return response.badRequest(`Cannot approve while relocation is "${reloc.status}"`)

    const app = toAttrs<any>(await RelocationApplication.find(appId))
    if (!app || Number(app.relocation_id) !== relocId)
      return response.notFound('Application not found for this relocation')

    if (app.status === 'approved' && Number(reloc.driver_id) === Number(app.user_id))
      return response.json({ data: app, already: true })

    const now = new Date().toISOString()
    const approved = toAttrs<any>(await RelocationApplication.update(appId, {
      status: 'approved',
      approved_at: now,
    }))

    // Reject every other pending application — drivers shouldn't keep waiting
    // on a job that's been awarded.
    try {
      await db.updateTable('relocation_applications')
        .set({ status: 'rejected', rejected_at: now, updated_at: now })
        .where('relocation_id', '=', relocId)
        .where('id', '!=', appId)
        .where('status', '=', 'pending')
        .execute()
    }
    catch { /* non-fatal */ }

    const updatedReloc = toAttrs<any>(await Relocation.update(relocId, {
      status: 'claimed',
      driver_id: Number(app.user_id),
    }))

    dispatch('relocation:approved', { relocation: updatedReloc, application: approved })
    return response.json({ data: { relocation: updatedReloc, application: approved } })
  },
})
