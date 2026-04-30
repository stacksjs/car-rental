export default new Action({
  name: 'SendBookingConfirmation',
  description: 'Notify the renter on email + database after a booking is created',

  async handle(booking: ModelRow<typeof Booking>) {
    if (!booking.user_id && !booking.driver_email) return { success: false }

    // Bookings carry the renter's user_id but not always a denormalized
    // `driver_email`. Resolve the address through the `belongsTo: User`
    // relation declared on the Booking model — eager-loading via
    // .with('user') means the proxy surfaces it as `b.user.email`.
    let email = booking.driver_email ?? undefined
    if (!email && booking.user_id) {
      const loaded = await Booking.query()
        .with('user')
        .where('id', Number(booking.id))
        .first() as ModelRow<typeof Booking> & { user?: ModelRow<typeof User> }
      email = loaded?.user?.email ?? undefined
    }

    const subject = `Your Drivly booking ${booking.reference} is confirmed`
    const body = `Booking ${booking.reference}: ${booking.start_date} → ${booking.end_date}, total $${booking.total}.`

    // Skip channels we don't have contact for — sending to email without
    // an address only earns us a warning log, not a delivered message.
    const channels: NotificationChannel[] = []
    if (email) channels.push('email')
    if (booking.user_id) channels.push('database')

    const results = await notify(
      { email, userId: booking.user_id ?? undefined },
      { subject, body, data: { booking_id: booking.id, reference: booking.reference } },
      channels,
    )

    log.info(`[booking] confirmation dispatched to ${email ?? `user#${booking.user_id}`}`)
    return { success: true, channels: results }
  },
})
