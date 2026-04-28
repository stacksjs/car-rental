/**
 * Driver drops off the car. Records end_odometer + completed_at, computes
 * actual_miles_driven and the payout, then flips status to `completed`.
 *
 * Payout calculation:
 *   - flat:     payout = flat_fee + fuel_allowance
 *   - per_mile: payout = round(per_mile_rate * actual_miles) + fuel_allowance
 *   - free:     payout = fuel_allowance (the perk *is* the free use of the car)
 *
 * The fuel allowance is paid even on `free` relocations so drivers aren't out
 * of pocket for tank fill-ups they made on the host's behalf.
 */

function computePayout(reloc: any, miles: number): number {
  const fuel = Number(reloc.fuel_allowance ?? 0)
  switch (reloc.compensation_type) {
    case 'flat':
      return Number(reloc.flat_fee ?? 0) + fuel
    case 'per_mile':
      return Math.round(Number(reloc.per_mile_rate ?? 0) * miles) + fuel
    case 'free':
    default:
      return fuel
  }
}

export default new Action({
  name: 'RelocationsCompleteAction',
  description: 'Driver drops off the car and closes out the relocation trip',
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

    if (reloc.status !== 'in_progress')
      return response.badRequest(`Cannot complete a relocation with status "${reloc.status}"`)

    const endOdometer = Number(request.get('end_odometer') ?? 0)
    if (!(endOdometer > 0)) return response.badRequest('end_odometer must be a positive number')

    const startOdometer = Number(reloc.start_odometer ?? 0)
    if (endOdometer < startOdometer)
      return response.badRequest('end_odometer cannot be less than start_odometer')

    const milesDriven = endOdometer - startOdometer
    const payout = computePayout(reloc, milesDriven)

    const updated = toAttrs<any>(await Relocation.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      end_odometer: endOdometer,
      actual_miles_driven: milesDriven,
      payout_amount: payout,
    }))

    dispatch('relocation:completed', updated)
    return response.json({ data: updated })
  },
})
