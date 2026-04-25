export default new Action({
  name: 'StripeWebhookAction',
  description: 'Handle Stripe platform events (payment_intents, invoices)',
  method: 'POST',

  async handle(request: RequestInstance) {
    const secret = (globalThis as any).process?.env?.STRIPE_WEBHOOK_SECRET
    const stripeSecret = (globalThis as any).process?.env?.STRIPE_SECRET_KEY
    if (!secret || !stripeSecret) return response.badRequest('Stripe webhook not configured')

    const sig = (request as any).header?.('stripe-signature')
    const rawBody = await (request as any).rawBody?.() ?? ''

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' } as any)

    let event: any
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret)
    } catch (err) {
      return response.badRequest(`Signature verification failed: ${(err as Error).message}`)
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object
        const bookingId = Number(intent.metadata?.booking_id)
        if (bookingId) {
          await Booking.update(bookingId, { status: 'confirmed' })
          const booking = await Booking.find(bookingId)
          dispatch('payment:succeeded', { booking, intent })
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object
        const bookingId = Number(intent.metadata?.booking_id)
        if (bookingId) {
          dispatch('payment:failed', { bookingId, intent })
        }
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_failed':
        dispatch(`subscription:${event.type.replace('invoice.', 'invoice_')}`, event.data.object)
        break
    }

    return response.json({ received: true })
  },
})
