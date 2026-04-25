function daysBetween(start: string, end: string): number {
  const a = new Date(start)
  const b = new Date(end)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function generateReference(): string {
  const n = Math.floor(100000 + Math.random() * 900000)
  return `DRV-${n}`
}

const PROTECTION_MULTIPLIER: Record<string, number> = {
  minimum: 0.12,
  standard: 0.22,
  premium: 0.35,
}

export default new Action({
  name: 'BookingStoreAction',
  description: 'Create a new booking with computed totals',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const rawCarId = request.get('car_id')
    const carSlug = request.get('car_slug') as string | undefined
    let carId = Number(rawCarId)
    if (!carId && carSlug) {
      const bySlug = await Car.query().where('slug', carSlug).first()
      if (bySlug) carId = Number((bySlug as any).id)
    }
    const startDate = String(request.get('start_date'))
    const endDate = String(request.get('end_date'))
    const protectionPlan = String(request.get('protection_plan') ?? 'standard')
    const pickupTime = String(request.get('pickup_time') ?? '10:00')
    const returnTime = String(request.get('return_time') ?? '10:00')
    const pickupLocation = String(request.get('pickup_location') ?? 'host')
    const deliveryAddress = request.get('delivery_address') as string | undefined
    const extras = (request.get('extras') ?? []) as Array<{ id: number, qty?: number }>

    if (!carId || !startDate || !endDate) {
      return response.badRequest('car_id, start_date, end_date are required')
    }

    const carModel = await Car.find(carId)
    if (!carModel) return response.notFound('Car not found')
    const car: any = (carModel as any)._attributes ?? (carModel as any).attributes ?? carModel

    const existing = await Booking.query()
      .where('car_id', carId)
      .whereIn('status', ['confirmed', 'active', 'pending'])
      .get()
    const overlap = (existing as any[]).some((b) => {
      const bb = b._attributes ?? b
      return !(bb.end_date < startDate || bb.start_date > endDate)
    })
    if (overlap)
      return response.badRequest('Car is not available for the selected dates')

    const days = daysBetween(startDate, endDate)
    const subtotal = Number(car.daily_rate) * days

    let extrasFee = 0
    if (Array.isArray(extras) && extras.length) {
      const ids = extras.map(e => Number(e.id))
      const extraRows = await Extra.query().whereIn('id', ids).get()
      for (const er of extraRows) {
        const e: any = (er as any)._attributes ?? er
        const chosen = extras.find(x => Number(x.id) === Number(e.id))
        const qty = chosen?.qty ?? 1
        extrasFee += Number(e.price_per_day ?? 0) * days * qty
      }
    }

    const protectionRate = PROTECTION_MULTIPLIER[protectionPlan] ?? 0.22
    const protectionFee = Math.round(subtotal * protectionRate)
    const taxes = Math.round((subtotal + protectionFee + extrasFee) * 0.08)
    const total = subtotal + protectionFee + extrasFee + taxes

    let platformFeeBps = 1500
    if (car.host_profile_id) {
      const hpModel = await HostProfile.find(Number(car.host_profile_id))
      const hp: any = (hpModel as any)?._attributes ?? hpModel
      platformFeeBps = Number(hp?.platform_fee_bps ?? 1500)
    }
    const platformFee = Math.round(total * (platformFeeBps / 10000))
    const payoutAmount = total - platformFee

    const booking = await Booking.create({
      car_id: carId,
      user_id: userId,
      reference: generateReference(),
      status: 'pending',
      start_date: startDate,
      end_date: endDate,
      pickup_time: pickupTime,
      return_time: returnTime,
      pickup_location: pickupLocation,
      delivery_address: deliveryAddress,
      protection_plan: protectionPlan,
      subtotal,
      protection_fee: protectionFee,
      extras_fee: extrasFee,
      taxes,
      total,
      platform_fee: platformFee,
      payout_amount: payoutAmount,
      driver_first_name: request.get('driver_first_name'),
      driver_last_name: request.get('driver_last_name'),
      driver_email: request.get('driver_email'),
      driver_phone: request.get('driver_phone'),
      driver_dob: request.get('driver_dob'),
      driver_license: request.get('driver_license'),
      driver_license_state: request.get('driver_license_state'),
      payment_method: request.get('payment_method') ?? 'card',
    })

    dispatch('booking:created', booking)

    return response.json({ data: booking })
  },
})
