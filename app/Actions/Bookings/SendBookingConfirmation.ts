export default new Action({
  name: 'SendBookingConfirmation',
  description: 'Emails the renter after a booking is created',

  async handle(booking: any) {
    if (!booking?.driver_email) return { success: false }

    const { html, text } = await template('booking-confirmation', {
      subject: `Your Drivly booking ${booking.reference} is confirmed`,
      variables: {
        reference: booking.reference,
        start: booking.start_date,
        end: booking.end_date,
        total: booking.total,
      },
    })

    await mail.send({ to: booking.driver_email, subject: `Booking ${booking.reference}`, html, text })
    log.info(`[booking] confirmation sent to ${booking.driver_email}`)
    return { success: true }
  },
})
