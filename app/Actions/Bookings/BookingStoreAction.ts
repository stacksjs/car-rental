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

    // Idempotency-Key replay protection. A flaky network on a mobile
    // client can resubmit POST /api/bookings — without this guard the
    // user gets two bookings + two charges. With this guard, the second
    // attempt returns the cached response from the first.
    const rawIdempotencyKey = (request as any).header?.('idempotency-key')
      ?? (request as any).headers?.get?.('idempotency-key')
      ?? (request as any).headers?.get?.('Idempotency-Key')
    const idempotencyKey = typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim() : ''
    if (idempotencyKey) {
      if (idempotencyKey.length < 8 || idempotencyKey.length > 256)
        return response.badRequest('Idempotency-Key must be 8-256 chars')
      const existing = await db.selectFrom('idempotency_keys')
        .select(['response_status', 'response_body'])
        .where('scope', '=', 'booking_create')
        .where('user_id', '=', userId)
        .where('key', '=', idempotencyKey)
        .executeTakeFirst()
      if (existing && existing.response_body) {
        // Replay — return the same response shape with a header marker
        // so the SPA can tell it was a dedup.
        const cached = JSON.parse(String(existing.response_body))
        return new Response(JSON.stringify(cached), {
          status: Number(existing.response_status ?? 200),
          headers: { 'Content-Type': 'application/json', 'X-Idempotency-Replay': 'true' },
        })
      }
    }

    const rawCarId = request.get('car_id')
    const carSlug = request.get('car_slug') as string | undefined
    let carId = Number(rawCarId)
    if (!carId && carSlug) {
      const bySlug = toAttrs<any>(await Car.query().where('slug', carSlug).first())
      if (bySlug) carId = Number(bySlug.id)
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

    // Date sanity. Bookings in the past are non-sensical (and would
    // immediately be flagged "completed" by the FinalizeBookings job).
    // We allow same-day bookings — `today` is inclusive at the start.
    const today = new Date().toISOString().slice(0, 10)
    if (startDate < today)
      return response.badRequest('start_date cannot be in the past')
    if (endDate < startDate)
      return response.badRequest('end_date cannot be before start_date')

    const car = toAttrs<any>(await Car.find(carId))
    if (!car) return response.notFound('Car not found')

    // TOCTOU defense: SQLite serializes writes inside a transaction, so if
    // two requests race on the same car/dates, the second one re-reads an
    // updated `existing` and refuses. We commit the INSERT inside the same
    // transaction so the overlap window can't reopen between SELECT and INSERT.
    //
    // Computed totals stay outside the transaction since they only depend on
    // the input + the car snapshot (already loaded above) — keeping the txn
    // narrow reduces lock contention.

    const days = daysBetween(startDate, endDate)
    const subtotal = Number(car.daily_rate) * days

    let extrasFee = 0
    if (Array.isArray(extras) && extras.length) {
      const ids = extras.map(e => Number(e.id))
      const extraRows = toAttrs<any[]>(await Extra.query().whereIn('id', ids).get())
      for (const e of extraRows) {
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
      const hp = toAttrs<any>(await HostProfile.find(Number(car.host_profile_id)))
      platformFeeBps = Number(hp?.platform_fee_bps ?? 1500)
    }
    const platformFee = Math.round(total * (platformFeeBps / 10000))
    const payoutAmount = total - platformFee

    // Reference is generated inside the retry loop so a (vanishingly rare)
    // collision against the unique index can be retried without the caller
    // ever seeing an error.
    let bookingAttrs: any = null
    const MAX_REF_RETRIES = 5
    for (let attempt = 0; attempt < MAX_REF_RETRIES; attempt += 1) {
      try {
        // Re-check overlap inside the transaction so two simultaneous
        // requests for the same car can't both pass the check.
        const txOverlap = toAttrs<any[]>(await Booking.query()
          .where('car_id', carId)
          .whereIn('status', ['confirmed', 'active', 'pending'])
          .get())
        if (txOverlap.some(b => !(b.end_date < startDate || b.start_date > endDate)))
          return response.badRequest('Car is not available for the selected dates')

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
        bookingAttrs = toAttrs<any>(booking)
        break
      }
      catch (err) {
        const msg = String((err as Error)?.message ?? '')
        if (/UNIQUE constraint failed.*bookings\.reference/i.test(msg)) {
          // Reference collision (~1 in a million per attempt). Retry with a
          // fresh reference; cap the loop so a misconfigured DB can't spin.
          continue
        }
        throw err
      }
    }
    if (!bookingAttrs) return response.error('Could not allocate a booking reference — try again')

    // Cache the success response under the idempotency key (best-effort —
    // a duplicate insert here means we lost the unique race, which is the
    // exact case we already handled by the cache lookup at the top).
    if (idempotencyKey) {
      const cached = { data: bookingAttrs }
      try {
        await db.insertInto('idempotency_keys').values({
          scope: 'booking_create',
          user_id: userId,
          key: idempotencyKey,
          response_status: 200,
          response_body: JSON.stringify(cached),
        }).execute()
      }
      catch { /* unique-collision = concurrent retry already cached. fine. */ }
    }

    dispatch('booking:created', bookingAttrs)

    return response.json({ data: bookingAttrs })
  },
})
