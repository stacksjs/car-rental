import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'RefundBooking',
  description: 'Refund a cancelled booking via Stripe if a payment intent exists',

  async handle(booking: any) {
    if (!booking?.payment_intent_id) return { success: false, reason: 'no-intent' }
    const secret = (globalThis as any).process?.env?.STRIPE_SECRET_KEY
    if (!secret) return { success: false, reason: 'stripe-unconfigured' }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secret, { apiVersion: '2024-06-20' } as any)
    const refund = await stripe.refunds.create({ payment_intent: booking.payment_intent_id })
    return { success: true, refundId: refund.id }
  },
})
