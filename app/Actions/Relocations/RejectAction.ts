/**
 * Host rejects a single application without affecting the relocation status.
 * The driver sees `rejected` next time they refresh their applications list.
 */

export default new Action({
  name: 'RelocationsRejectAction',
  description: 'Host rejects a driver application',
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

    const app = toAttrs<any>(await RelocationApplication.find(appId))
    if (!app || Number(app.relocation_id) !== relocId)
      return response.notFound('Application not found for this relocation')

    if (app.status === 'approved')
      return response.badRequest('Cannot reject an approved application — cancel the relocation instead')

    const updated = toAttrs<any>(await RelocationApplication.update(appId, {
      status: 'rejected',
      rejected_at: new Date().toISOString(),
    }))

    dispatch('relocation:application:rejected', { relocation: reloc, application: updated })
    return response.json({ data: updated })
  },
})
