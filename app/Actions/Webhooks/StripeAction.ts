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
    }
    catch (err) {
      return response.badRequest(`Signature verification failed: ${(err as Error).message}`)
    }

    // Idempotency: Stripe retries on transient 5xxs, sometimes for hours.
    // We claim the event id with a UNIQUE insert; the second attempt loses
    // the race and we 200-ack without re-running side effects.
    try {
      await db.insertInto('webhook_events').values({
        provider: 'stripe',
        event_id: String(event.id),
        event_type: String(event.type ?? ''),
      }).execute()
    }
    catch (err) {
      const msg = String((err as Error)?.message ?? '')
      if (/UNIQUE constraint failed.*webhook_events/i.test(msg))
        return response.json({ received: true, duplicate: true })
      throw err
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object
        const bookingId = Number(intent.metadata?.booking_id)
        if (bookingId) {
          const booking = toAttrs(await Booking.update(bookingId, { status: 'confirmed' }))
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
