import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

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
    } catch (err) {
      return response.badRequest(`Signature verification failed: ${(err as Error).message}`)
    }

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object
        const profile = await HostProfile.query().where('stripe_account_id', account.id).first()
        if (profile) {
          await HostProfile.update((profile as any).id, {
            chargesEnabled: !!account.charges_enabled,
            payoutsEnabled: !!account.payouts_enabled,
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
