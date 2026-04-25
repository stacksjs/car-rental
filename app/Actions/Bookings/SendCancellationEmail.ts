export default new Action({
  name: 'SendCancellationEmail',
  description: 'Notify both parties on email + inbox when a booking is cancelled',

  async handle(booking: any) {
    const email = booking?.driver_email
    if (!email && !booking?.user_id) return { success: false }

    const reason = booking.cancellation_reason ? ` Reason: ${booking.cancellation_reason}.` : ''

    await notify(
      { email, userId: booking.user_id },
      {
        subject: `Booking ${booking.reference} cancelled`,
        body: `Your booking ${booking.reference} has been cancelled.${reason}`,
        data: { booking_id: booking.id, reference: booking.reference },
      },
      ['email', 'database'],
    )

    return { success: true }
  },
})
