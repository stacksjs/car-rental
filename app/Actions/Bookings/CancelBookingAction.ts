export default new Action({
  name: 'CancelBookingAction',
  description: 'Cancel a pending/confirmed booking',
  method: 'POST',

  async handle(request: RequestInstance) {
    const user = await resolveAuthedUser(request)
    if (!user) return response.unauthorized('Auth required')

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('booking id required')

    const bookingModel = await Booking.find(id)
    if (!bookingModel) return response.notFound('Booking not found')
    const booking: any = (bookingModel as any)._attributes ?? bookingModel

    const { default: policy } = await import('../../Policies/BookingPolicy')
    const userAttrs = (user as any)._attributes ?? user
    if (!await policy.cancel(userAttrs, booking))
      return response.forbidden('You cannot cancel this booking')

    const reason = String(request.get('reason') ?? '')

    try {
      await (db as any).updateTable('bookings')
        .set({ status: 'cancelled', cancellation_reason: reason, updated_at: new Date().toISOString() })
        .where('id', '=', id)
        .execute()
    }
    catch {
      await Booking.update(id, { status: 'cancelled', cancellation_reason: reason })
    }

    const updatedModel = await Booking.find(id)
    const updated = (updatedModel as any)?._attributes ?? updatedModel
    dispatch('booking:cancelled', updated)

    return response.json({ data: updated })
  },
})
