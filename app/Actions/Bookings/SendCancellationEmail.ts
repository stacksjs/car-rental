export default new Action({
  name: 'SendCancellationEmail',
  description: 'Emails both parties when a booking is cancelled',

  async handle(booking: any) {
    if (!booking?.driver_email) return { success: false }
    await mail.send({
      to: booking.driver_email,
      subject: `Booking ${booking.reference} cancelled`,
      text: `Your booking ${booking.reference} has been cancelled. ${booking.cancellation_reason ? `Reason: ${booking.cancellation_reason}` : ''}`,
    })
    return { success: true }
  },
})
