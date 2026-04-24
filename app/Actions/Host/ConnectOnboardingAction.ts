import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'HostConnectOnboardingAction',
  description: 'Create / refresh Stripe Connect Express account link for host KYC',
  method: 'POST',

  async handle(request: RequestInstance) {
    const user = (request as any).user
    if (!user) return response.unauthorized('Auth required')

    const hostProfile = await HostProfile.query().where('user_id', (user as any).id).first()
    if (!hostProfile) return response.badRequest('Host profile missing; apply first')

    const appUrl = (globalThis as any).process?.env?.APP_URL ?? 'http://localhost:3000'
    const secret = (globalThis as any).process?.env?.STRIPE_SECRET_KEY
    if (!secret) return response.badRequest('Stripe not configured')

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secret, { apiVersion: '2024-06-20' } as any)

    let accountId = (hostProfile as any).stripe_account_id as string | null
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: (user as any).email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      })
      accountId = account.id
      await HostProfile.update((hostProfile as any).id, { stripe_account_id: accountId })
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/host/dashboard?connect=refresh`,
      return_url: `${appUrl}/api/host/connect/return`,
      type: 'account_onboarding',
    })

    return response.json({ url: link.url, accountId })
  },
})
