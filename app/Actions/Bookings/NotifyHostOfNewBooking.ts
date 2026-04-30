export default new Action({
  name: 'NotifyHostOfNewBooking',
  description: 'Notify the host on email + in-app inbox when a new booking lands',

  async handle(booking: ModelRow<typeof Booking>) {
    if (!booking.car_id) return { success: false }

    // Walk the relations off Booking → Car → HostProfile → User in a
    // single eager-load. The proxy surfaces nested loaded relations as
    // direct property access (`b.car.host_profile.user.email`), so the
    // listener stays a flat read.
    const loaded = await Booking.query()
      .with('car')
      .where('id', Number(booking.id))
      .first() as ModelRow<typeof Booking> & { car?: ModelRow<typeof Car> }

    const car = loaded?.car
    if (!car?.host_profile_id) return { success: false }

    const hostProfile = await HostProfile.find(Number(car.host_profile_id)) as ModelRow<typeof HostProfile> | undefined
    if (!hostProfile?.user_id) return { success: false }

    const host = await User.find(Number(hostProfile.user_id)) as ModelRow<typeof User> | undefined
    const hostEmail = host?.email

    const channels: NotificationChannel[] = ['database']
    if (hostEmail) channels.unshift('email')

    await notify(
      { email: hostEmail, userId: hostProfile.user_id },
      {
        subject: `New booking for your ${car.make ?? 'car'} ${car.model ?? ''}`.trim(),
        body: `You have a new booking ${booking.reference} from ${booking.start_date} to ${booking.end_date}.`,
        data: { booking_id: booking.id, car_id: car.id, reference: booking.reference },
      },
      channels,
    )

    log.info(`[booking] host ${hostEmail ?? `user#${hostProfile.user_id}`} notified of ${booking.reference}`)
    return { success: true }
  },
})
