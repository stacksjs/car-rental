/**
 * Single relocation posting + car/host snapshot + visible applications.
 *
 * Public for open postings. The visible application set differs by viewer:
 *   - host (owner): sees every application
 *   - applicant driver: sees only their own
 *   - everyone else: no applications
 */

export default new Action({
  name: 'RelocationsShowAction',
  description: 'Single relocation with car/host context',
  method: 'GET',

  async handle(request: RequestInstance) {
    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('id required')

    const reloc = toAttrs<any>(await Relocation.find(id))
    if (!reloc) return response.notFound('Relocation not found')

    const car = reloc.car_id ? toAttrs<any>(await Car.find(reloc.car_id)) : null
    const hostProfile = reloc.host_profile_id ? toAttrs<any>(await HostProfile.find(reloc.host_profile_id)) : null
    const hostUser = hostProfile?.user_id ? toAttrs<any>(await User.find(hostProfile.user_id)) : null

    const viewer = await resolveAuthedUser(request).catch(() => null)
    const viewerAttrs = viewer ? toAttrs<any>(viewer) : null
    const viewerId = viewerAttrs?.id ? Number(viewerAttrs.id) : null

    const isHostOwner = hostProfile && viewerAttrs && Number(hostProfile.user_id) === viewerId

    let applications: any[] = []
    if (isHostOwner) {
      applications = toAttrs<any[]>(await RelocationApplication.query().where('relocation_id', id).orderBy('created_at', 'asc').get())
      const userIds = [...new Set(applications.map(a => Number(a.user_id)).filter(Boolean))]
      const users = userIds.length ? toAttrs<any[]>(await User.query().whereIn('id', userIds).get()) : []
      const byId = new Map(users.map((u: any) => [Number(u.id), u]))
      applications = applications.map(a => ({ ...a, applicant: byId.get(Number(a.user_id)) ?? null }))
    }
    else if (viewerId) {
      const mine = toAttrs<any>(await RelocationApplication.query().where('relocation_id', id).where('user_id', viewerId).first())
      if (mine) applications = [mine]
    }

    return response.json({
      data: {
        ...reloc,
        car,
        host: hostProfile ? {
          id: hostProfile.id,
          name: hostUser?.name ?? null,
          rating: hostProfile.rating,
          response_time: hostProfile.response_time,
          verified: !!hostProfile.verified,
        } : null,
        applications,
        viewer: { isHostOwner: !!isHostOwner, isAuthed: !!viewerId },
      },
    })
  },
})
