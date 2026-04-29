import { computePay } from '../Roadtrips/_helpers'
import { syncLegsForUserAndRelocation } from '../Roadtrips/_legSync'

/**
 * Driver drops off the car. Records end_odometer + completed_at, computes
 * actual_miles_driven and the payout, then flips status to `completed`.
 *
 * Payout calculation goes through the centralized computePay helper so
 * the planner's "estimated_pay" lines up with what actually settles
 * here at completion. See app/Actions/Roadtrips/_helpers.ts:computePay
 * for the formula (flat / per_mile / free).
 *
 * The fuel allowance is paid even on `free` relocations so drivers aren't
 * out of pocket for tank fill-ups they made on the host's behalf.
 */

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
    const payout = computePay({
      compensation_type: reloc.compensation_type,
      flat_fee: Number(reloc.flat_fee ?? 0),
      per_mile_rate: Number(reloc.per_mile_rate ?? 0),
      fuel_allowance: Number(reloc.fuel_allowance ?? 0),
      actual_miles_driven: milesDriven,
    })

    const updated = toAttrs<any>(await Relocation.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      end_odometer: endOdometer,
      actual_miles_driven: milesDriven,
      payout_amount: payout,
    }))

    await syncLegsForUserAndRelocation({
      userId: Number(userId),
      relocationId: id,
      legStatus: 'completed',
    })

    dispatch('relocation:completed', updated)
    return response.json({ data: updated })
  },
})
