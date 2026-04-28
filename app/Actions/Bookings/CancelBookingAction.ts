export default new Action({
  name: 'CancelBookingAction',
  description: 'Cancel a pending/confirmed booking',
  method: 'POST',

  async handle(request: RequestInstance) {
    const user = await resolveAuthedUser(request)
    if (!user) return response.unauthorized('Auth required')

    const id = Number((request as any).params?.id)
    if (!id) return response.badRequest('booking id required')

    const booking = toAttrs<any>(await Booking.find(id))
    if (!booking) return response.notFound('Booking not found')

    const { default: policy } = await import('../../Policies/BookingPolicy')
    const userAttrs = toAttrs(user)
    if (!await policy.cancel(userAttrs, booking))
      return response.forbidden('You cannot cancel this booking')

    const reason = String(request.get('reason') ?? '')

    const updated = toAttrs<any>(await Booking.update(id, { status: 'cancelled', cancellation_reason: reason }))
    dispatch('booking:cancelled', updated)

    return response.json({ data: updated })
  },
})
