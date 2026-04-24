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
    const role = (userRaw?._attributes?.role ?? userRaw?.role) as string | undefined

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('booking id required')

    const bookingModel = await Booking.find(id)
    if (!bookingModel) return response.notFound('Booking not found')
    const booking: any = (bookingModel as any)._attributes ?? bookingModel

    const isAdmin = role === 'admin'
    if (!isAdmin && Number(booking.user_id) !== userId)
      return response.forbidden('Not your booking')

    if (['completed', 'cancelled'].includes(String(booking.status)))
      return response.badRequest('Booking cannot be cancelled')

    const reason = String(request.get('reason') ?? '')

    // Direct db update to avoid fillable-map surprises on partial writes.
    try {
      const { db } = await import('@stacksjs/database')
      await (db as any).updateTable('bookings')
        .set({ status: 'cancelled', cancellation_reason: reason, updated_at: new Date().toISOString() })
        .where('id', '=', id)
        .execute()
    }
    catch {
      // Fall back to ORM path if the raw query fails (e.g. non-SQL driver).
      await Booking.update(id, { status: 'cancelled', cancellation_reason: reason })
    }

    const updatedModel = await Booking.find(id)
    const updated = (updatedModel as any)?._attributes ?? updatedModel
    dispatch('booking:cancelled', updated)

    return response.json({ data: updated })
  },
})
