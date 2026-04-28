/**
 * Host's own relocation postings, grouped by status, with pending application
 * counts so the dashboard can badge "3 drivers waiting" without a second
 * round-trip per row.
 */

export default new Action({
  name: 'RelocationsMyHostAction',
  description: 'List the authed host\'s relocation postings',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const hostProfile = toAttrs<any>(await HostProfile.query().where('user_id', userId).first())
    if (!hostProfile) return response.json({ open: [], claimed: [], in_progress: [], completed: [], cancelled: [] })

    const rows = toAttrs<any[]>(await Relocation.query()
      .where('host_profile_id', hostProfile.id)
      .orderBy('created_at', 'desc')
      .get())

    const carIds = [...new Set(rows.map(r => Number(r.car_id)).filter(Boolean))]
    const cars = carIds.length ? toAttrs<any[]>(await Car.query().whereIn('id', carIds).get()) : []
    const carById = new Map<number, any>()
    for (const c of cars) carById.set(Number(c.id), c)

    // Per-relocation pending application count — driver-facing badge.
    const ids = rows.map(r => Number(r.id))
    const apps = ids.length
      ? toAttrs<any[]>(await RelocationApplication.query().whereIn('relocation_id', ids).where('status', 'pending').get())
      : []
    const pendingByRelocation = new Map<number, number>()
    for (const a of apps) pendingByRelocation.set(Number(a.relocation_id), (pendingByRelocation.get(Number(a.relocation_id)) ?? 0) + 1)

    const hydrated = rows.map(r => ({
      ...r,
      car: carById.get(Number(r.car_id)) ?? null,
      pending_applications: pendingByRelocation.get(Number(r.id)) ?? 0,
    }))

    const grouped = {
      open: hydrated.filter(r => r.status === 'open'),
      claimed: hydrated.filter(r => r.status === 'claimed'),
      in_progress: hydrated.filter(r => r.status === 'in_progress'),
      completed: hydrated.filter(r => r.status === 'completed'),
      cancelled: hydrated.filter(r => r.status === 'cancelled'),
    }

    return response.json({ ...grouped, total: hydrated.length })
  },
})
