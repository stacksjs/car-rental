export default new Action({
  name: 'NotifyHostOfNewBooking',
  description: 'Notify the host on email + in-app inbox when a new booking lands',

  async handle(booking: any) {
    const car = await Car.find(booking.car_id) as any
    const hostProfile = await HostProfile.find(car?.host_profile_id) as any
    if (!hostProfile) return { success: false }

    const host = await User.find(hostProfile.user_id) as any
    const hostEmail = host?._attributes?.email ?? host?.email

    await notify(
      { email: hostEmail, userId: hostProfile.user_id },
      {
        subject: `New booking for your ${car?._attributes?.make ?? 'car'} ${car?._attributes?.model ?? ''}`.trim(),
        body: `You have a new booking ${booking.reference} from ${booking.start_date} to ${booking.end_date}.`,
        data: { booking_id: booking.id, car_id: car?._attributes?.id, reference: booking.reference },
      },
      ['email', 'database'],
    )

    log.info(`[booking] host ${hostEmail} notified of ${booking.reference}`)
    return { success: true }
  },
})
