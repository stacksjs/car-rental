import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dispatch } from '@stacksjs/events'
import { authedUserId, resolveAuthedUser } from '../helpers/auth'

export default new Action({
  name: 'CancelBookingAction',
  description: 'Cancel a pending/confirmed booking',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const userRaw = await resolveAuthedUser(request)
    const role = userRaw?._attributes?.role ?? userRaw?.role

    const id = Number((request as any).params?.id)
    const bookingModel = await Booking.find(id)
    if (!bookingModel) return response.notFound('Booking not found')
    const booking: any = (bookingModel as any)._attributes ?? bookingModel

    const isAdmin = role === 'admin'
    if (!isAdmin && Number(booking.user_id) !== userId)
      return response.forbidden('Not your booking')

    if (['completed', 'cancelled'].includes(booking.status))
      return response.badRequest('Booking cannot be cancelled')

    const reason = String(request.get('reason') ?? '')
    await Booking.update(id, { status: 'cancelled', cancellation_reason: reason })
    const updated = await Booking.find(id)
    dispatch('booking:cancelled', (updated as any)?._attributes ?? updated)

    return response.json({ data: (updated as any)?._attributes ?? updated })
  },
})
