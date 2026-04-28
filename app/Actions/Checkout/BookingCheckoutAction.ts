export default new Action({
  name: 'BookingCheckoutAction',
  description: 'Create Stripe PaymentIntent with platform-fee split for a booking',
  method: 'POST',

  async handle(request: RequestInstance) {
    const user = (request as any).user
    if (!user) return response.unauthorized('Auth required')

    const bookingId = Number((request as any).params?.id)
    const booking = toAttrs<any>(await Booking.find(bookingId))
    if (!booking) return response.notFound('Booking not found')
    if (booking.user_id !== (user as any).id)
      return response.forbidden('Not your booking')

    const car = toAttrs<any>(await Car.find(booking.car_id))
    if (!car) return response.notFound('Car not found')

    const hostProfile = car.host_profile_id ? toAttrs<any>(await HostProfile.find(car.host_profile_id)) : null
    const hostAccountId = hostProfile?.stripe_account_id

    const secret = (globalThis as any).process?.env?.STRIPE_SECRET_KEY
    if (!secret) return response.badRequest('Stripe not configured')

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secret, { apiVersion: '2024-06-20' } as any)

    const amountCents = Math.round(Number(booking.total) * 100)
    const platformFeeCents = Math.round(Number(booking.platform_fee ?? 0) * 100)

    const params: any = {
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { booking_id: String(bookingId), booking_ref: booking.reference },
    }

    if (hostAccountId && hostProfile?.charges_enabled && hostProfile?.payouts_enabled) {
      params.application_fee_amount = platformFeeCents
      params.transfer_data = { destination: hostAccountId }
    }

    const intent = await stripe.paymentIntents.create(params)
    await Booking.update(bookingId, { payment_intent_id: intent.id })

    return response.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id })
  },
})
