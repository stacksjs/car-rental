/**
 * Driver's relocation activity:
 *   - applications:    pending/rejected applications they've submitted
 *   - active:          relocations they've been approved for and are
 *                      claimed/in_progress on
 *   - history:         completed relocations (with payout amounts)
 */

export default new Action({
  name: 'RelocationsMyDriverAction',
  description: 'List the authed driver\'s relocation applications + trips',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const apps = toAttrs<any[]>(await RelocationApplication.query()
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .get())

    const trips = toAttrs<any[]>(await Relocation.query()
      .where('driver_id', userId)
      .orderBy('updated_at', 'desc')
      .get())

    const allRelocIds = [
      ...new Set([
        ...apps.map(a => Number(a.relocation_id)),
        ...trips.map(t => Number(t.id)),
      ].filter(Boolean)),
    ]
    const relocs = allRelocIds.length
      ? toAttrs<any[]>(await Relocation.query().whereIn('id', allRelocIds).get())
      : []
    const relocById = new Map<number, any>()
    for (const r of relocs) relocById.set(Number(r.id), r)

    const carIds = [...new Set(relocs.map(r => Number(r.car_id)).filter(Boolean))]
    const cars = carIds.length ? toAttrs<any[]>(await Car.query().whereIn('id', carIds).get()) : []
    const carById = new Map<number, any>()
    for (const c of cars) carById.set(Number(c.id), c)

    const decorate = (reloc: any) => reloc ? { ...reloc, car: carById.get(Number(reloc.car_id)) ?? null } : null

    const applications = apps.map(a => ({ ...a, relocation: decorate(relocById.get(Number(a.relocation_id))) }))

    const active = trips
      .filter(t => t.status === 'claimed' || t.status === 'in_progress')
      .map(decorate)

    const history = trips
      .filter(t => t.status === 'completed' || t.status === 'cancelled')
      .map(decorate)

    return response.json({ applications, active, history, total: applications.length + active.length + history.length })
  },
})
