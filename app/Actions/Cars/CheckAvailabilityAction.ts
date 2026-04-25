async function resolveCar(idOrSlug: any): Promise<any | null> {
  if (idOrSlug == null) return null
  const asNum = Number(idOrSlug)
  if (Number.isFinite(asNum) && asNum > 0) {
    const byId = await Car.find(asNum)
    if (byId) return byId
  }
  return await Car.query().where('slug', String(idOrSlug)).first()
}

export default new Action({
  name: 'CheckAvailabilityAction',
  description: 'Return booked windows + availability for a car (accepts id or slug)',
  method: 'GET',

  async handle(request: RequestInstance) {
    const key = (request as any).params?.id
    const from = request.get('from') as string | undefined
    const to = request.get('to') as string | undefined

    const car = await resolveCar(key)
    if (!car) return response.notFound('Car not found')

    const overlapping = await Booking.query()
      .where('car_id', Number((car as any).id))
      .whereIn('status', ['confirmed', 'active', 'pending'])
      .get()

    const busy = (overlapping as any[]).map(b => ({ from: b.start_date, to: b.end_date, status: b.status }))

    let isAvailable = true
    if (from && to)
      isAvailable = !busy.some(w => !(w.to < from || w.from > to))

    return response.json({ carId: (car as any).id, slug: (car as any).slug, isAvailable, busy })
  },
})
