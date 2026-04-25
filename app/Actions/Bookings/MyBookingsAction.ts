export default new Action({
  name: 'MyBookingsAction',
  description: "List the authed user's bookings with car details, grouped by tab (upcoming/past/cancelled)",
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const today = new Date().toISOString().slice(0, 10)
    const bookingRows = await Booking.query()
      .where('user_id', userId)
      .orderBy('start_date', 'desc')
      .get()
    const bookings = (bookingRows as any[]).map(b => b._attributes ?? b)

    const carIds = [...new Set(bookings.map(b => Number(b.car_id)).filter(Boolean))]
    const carRows = carIds.length
      ? await Car.query().whereIn('id', carIds).get()
      : []
    const carById = new Map<number, any>()
    for (const c of carRows as any[]) {
      const attrs = c._attributes ?? c
      carById.set(Number(attrs.id), attrs)
    }

    // Hydrate each booking with a compact `car` snapshot the drivly template expects.
    const hydrated = bookings.map(b => ({
      ...b,
      // Drivly template expects these top-level aliases
      carId: carById.get(Number(b.car_id))?.slug ?? String(b.car_id),
      from: b.start_date,
      to: b.end_date,
      pickupTime: b.pickup_time,
      total: Number(b.total ?? 0),
      car: carById.get(Number(b.car_id)) ?? null,
    }))

    const upcoming = hydrated.filter(b => b.status !== 'cancelled' && b.end_date >= today)
    const past = hydrated.filter(b => b.status !== 'cancelled' && b.end_date < today)
    const cancelled = hydrated.filter(b => b.status === 'cancelled')

    return response.json({ upcoming, past, cancelled, total: hydrated.length })
  },
})
