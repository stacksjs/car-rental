import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'HostConnectReturnAction',
  description: 'Callback after Stripe Connect onboarding; syncs capabilities',
  method: 'GET',

  async handle(request: RequestInstance) {
    const user = (request as any).user
    if (!user) return response.redirect('/login?next=/host/dashboard')

    const hostProfile = await HostProfile.query().where('user_id', (user as any).id).first()
    if (!hostProfile || !(hostProfile as any).stripe_account_id)
      return response.redirect('/host/dashboard')

    const secret = (globalThis as any).process?.env?.STRIPE_SECRET_KEY
    if (secret) {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(secret, { apiVersion: '2024-06-20' } as any)
      const account = await stripe.accounts.retrieve((hostProfile as any).stripe_account_id)
      await HostProfile.update((hostProfile as any).id, {
        chargesEnabled: !!account.charges_enabled,
        payoutsEnabled: !!account.payouts_enabled,
      })
    }

    return response.redirect('/host/dashboard?connected=1')
  },
})
