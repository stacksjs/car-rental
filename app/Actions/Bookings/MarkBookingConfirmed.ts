export default new Action({
  name: 'MarkBookingConfirmed',
  description: 'Flip booking status to confirmed on payment success',

  async handle(payload: any) {
    const booking = payload?.booking ?? payload
    if (!booking?.id) return { success: false }
    await Booking.update(booking.id, { status: 'confirmed' })
    return { success: true }
  },
})
