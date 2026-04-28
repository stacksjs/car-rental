export default new Action({
  name: 'StripeConnectWebhookAction',
  description: 'Handle Stripe Connect events (account.updated, payout.*)',
  method: 'POST',

  async handle(request: RequestInstance) {
    const secret = (globalThis as any).process?.env?.STRIPE_CONNECT_WEBHOOK_SECRET ?? (globalThis as any).process?.env?.STRIPE_WEBHOOK_SECRET
    const stripeSecret = (globalThis as any).process?.env?.STRIPE_SECRET_KEY
    if (!secret || !stripeSecret) return response.badRequest('Stripe connect webhook not configured')

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

    // Same idempotency guard as the platform webhook — see StripeAction.ts.
    // We use 'stripe-connect' as the provider key so the two endpoints
    // can't collide on event ids that overlap across accounts.
    try {
      await db.insertInto('webhook_events').values({
        provider: 'stripe-connect',
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
      case 'account.updated': {
        const account = event.data.object
        const profile = toAttrs<any>(await HostProfile.query().where('stripe_account_id', account.id).first())
        if (profile) {
          await HostProfile.update(profile.id, {
            charges_enabled: !!account.charges_enabled,
            payouts_enabled: !!account.payouts_enabled,
          })
        }
        break
      }
      case 'payout.paid':
      case 'payout.failed':
        // Could log payouts or notify host — intentional no-op for now
        break
    }

    return response.json({ received: true })
  },
})
