/**
 * Driver picks up the car. Records the start odometer + start_at timestamp
 * and moves the relocation to `in_progress`.
 *
 * Only the approved driver can start. Body accepts `start_odometer` (number,
 * required) — the driver checks the dashboard before driving away so the
 * end-of-trip mileage is honest.
 */

export default new Action({
  name: 'RelocationsStartAction',
  description: 'Driver picks up the car and starts the relocation trip',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('id required')

    const reloc = toAttrs<any>(await Relocation.find(id))
    if (!reloc) return response.notFound('Relocation not found')

    if (Number(reloc.driver_id) !== Number(userId))
      return response.forbidden('You are not the assigned driver')

    if (reloc.status !== 'claimed')
      return response.badRequest(`Cannot start a relocation with status "${reloc.status}"`)

    const startOdometer = Number(request.get('start_odometer') ?? 0)
    if (!(startOdometer > 0)) return response.badRequest('start_odometer must be a positive number')

    const updated = toAttrs<any>(await Relocation.update(id, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
      start_odometer: startOdometer,
    }))

    dispatch('relocation:started', updated)
    return response.json({ data: updated })
  },
})
