export default new Action({
  name: 'SendBookingConfirmation',
  description: 'Notify the renter on email + database after a booking is created',

  async handle(booking: any) {
    const email = booking?.driver_email
    if (!email && !booking?.user_id) return { success: false }

    const subject = `Your Drivly booking ${booking.reference} is confirmed`
    const body = `Booking ${booking.reference}: ${booking.start_date} → ${booking.end_date}, total $${booking.total}.`

    const results = await notify(
      { email, userId: booking.user_id },
      { subject, body, data: { booking_id: booking.id, reference: booking.reference } },
      ['email', 'database'],
    )

    log.info(`[booking] confirmation dispatched to ${email ?? `user#${booking.user_id}`}`)
    return { success: true, channels: results }
  },
})
