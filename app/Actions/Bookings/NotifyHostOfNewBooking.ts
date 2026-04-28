export default new Action({
  name: 'NotifyHostOfNewBooking',
  description: 'Notify the host on email + in-app inbox when a new booking lands',

  async handle(booking: any) {
    const car = toAttrs<any>(await Car.find(booking.car_id))
    if (!car?.host_profile_id) return { success: false }

    const hostProfile = toAttrs<any>(await HostProfile.find(car.host_profile_id))
    if (!hostProfile) return { success: false }

    const host = toAttrs<any>(await User.find(hostProfile.user_id))
    const hostEmail = host?.email

    await notify(
      { email: hostEmail, userId: hostProfile.user_id },
      {
        subject: `New booking for your ${car.make ?? 'car'} ${car.model ?? ''}`.trim(),
        body: `You have a new booking ${booking.reference} from ${booking.start_date} to ${booking.end_date}.`,
        data: { booking_id: booking.id, car_id: car.id, reference: booking.reference },
      },
      ['email', 'database'],
    )

    log.info(`[booking] host ${hostEmail} notified of ${booking.reference}`)
    return { success: true }
  },
})
