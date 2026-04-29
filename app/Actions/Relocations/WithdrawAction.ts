import { withdrawApplication } from '../Roadtrips/_legSync'

/**
 * Driver withdraws their own application from a relocation.
 *
 *   - If the application is `pending`, it just flips to `withdrawn`.
 *   - If the application was already `approved` (relocation in `claimed`
 *     state), the relocation reverts to `open` and `driver_id` clears so
 *     the host can pick another applicant.
 *   - If the relocation is `in_progress` or `completed`, withdrawal is
 *     refused — at that point we need the host-side cancel flow, not a
 *     self-withdraw.
 *
 * Mirrors onto any roadtrip_legs the user owns that point at this
 * relocation (status → `cancelled`).
 */
export default new Action({
  name: 'RelocationsWithdrawAction',
  description: 'Driver withdraws their application from a relocation',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('id required')

    const result = await withdrawApplication({ relocationId: id, userId: Number(userId) })

    if (!result.ok) {
      if (result.reason === 'relocation_not_found') return response.notFound('Relocation not found')
      if (result.reason === 'no_application') return response.notFound('No application to withdraw')
      if (result.reason === 'trip_in_progress')
        return response.badRequest('Cannot withdraw once the trip is in progress — contact the host')
      return response.badRequest(result.reason ?? 'Withdraw failed')
    }

    dispatch('relocation:application:withdrawn', {
      relocation: result.relocation,
      application: result.application,
    })
    return response.json({
      data: { application: result.application, relocation: result.relocation },
    })
  },
})
