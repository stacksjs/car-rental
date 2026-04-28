export default new Action({
  name: 'HostDashboardAction',
  description: 'Host earnings + upcoming bookings + KPIs',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const role = toAttrs<any>(await resolveAuthedUser(request))?.role
    if (role !== 'host' && role !== 'admin') return response.forbidden('Hosts only')

    const hostProfile = toAttrs<any>(await HostProfile.query().where('user_id', userId).first())
    if (!hostProfile) return response.json({ empty: true })

    const cars = toAttrs<any[]>(await Car.query().where('host_profile_id', hostProfile.id).get())
    const carIds = cars.map(c => Number(c.id))

    const bookings = carIds.length
      ? toAttrs<any[]>(await Booking.query().whereIn('car_id', carIds).orderBy('start_date', 'desc').get())
      : []

    const completed = bookings.filter(b => b.status === 'completed')
    const totalEarnings = completed.reduce((sum, b) => sum + Number(b.payout_amount ?? 0), 0)

    const today = new Date().toISOString().slice(0, 10)
    const upcoming = bookings.filter(b => b.status !== 'cancelled' && b.end_date >= today).slice(0, 8)

    const monthly: Record<string, number> = {}
    for (const b of completed) {
      const month = String(b.start_date).slice(0, 7)
      monthly[month] = (monthly[month] ?? 0) + Number(b.payout_amount ?? 0)
    }

    return response.json({
      kpis: {
        totalEarnings,
        activeListings: cars.filter(c => c.status === 'active').length,
        completionRate: completed.length / Math.max(1, bookings.length),
        totalTrips: Number(hostProfile.trips ?? 0),
        rating: Number(hostProfile.rating ?? 0),
      },
      monthly,
      upcoming,
      cars,
      chargesEnabled: !!hostProfile.charges_enabled,
      payoutsEnabled: !!hostProfile.payouts_enabled,
    })
  },
})
