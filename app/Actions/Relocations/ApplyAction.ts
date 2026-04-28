/**
 * Driver applies to a relocation. The application is "pending" until the
 * host approves (or rejects) it via the host UI.
 *
 * Guards:
 *   - Relocation must be `open` (no taking on a job already claimed).
 *   - Driver is not the host themselves (no self-driving your own posting).
 *   - One pending application per (relocation, user) — re-applying after a
 *     rejection re-uses the same row instead of duplicating it.
 */

export default new Action({
  name: 'RelocationsApplyAction',
  description: 'Driver applies to drive a relocation',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('id required')

    const reloc = toAttrs<any>(await Relocation.find(id))
    if (!reloc) return response.notFound('Relocation not found')
    if (reloc.status !== 'open') return response.badRequest('This relocation is no longer open')

    const hostProfile = toAttrs<any>(await HostProfile.find(reloc.host_profile_id))
    if (hostProfile && Number(hostProfile.user_id) === Number(userId))
      return response.badRequest('You cannot apply to your own relocation')

    const message = String(request.get('message') ?? '').slice(0, 1000)

    // Re-use any existing app for this (relocation, user) — switch it back
    // to pending if the driver previously withdrew or was rejected.
    const existing = toAttrs<any>(await RelocationApplication.query()
      .where('relocation_id', id)
      .where('user_id', userId)
      .first())

    let app: any
    if (existing) {
      if (existing.status === 'pending')
        return response.json({ data: existing, already: true })
      app = toAttrs<any>(await RelocationApplication.update(existing.id, {
        status: 'pending',
        message: message || existing.message,
      }))
    }
    else {
      app = toAttrs<any>(await RelocationApplication.create({
        relocation_id: id,
        user_id: Number(userId),
        status: 'pending',
        message,
      }))
    }

    dispatch('relocation:application:created', { relocation: reloc, application: app })
    return response.json({ data: app })
  },
})
