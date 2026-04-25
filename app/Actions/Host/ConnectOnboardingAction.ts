export default new Action({
  name: 'HostConnectOnboardingAction',
  description: 'Create / refresh Stripe Connect Express account link for host KYC',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const hpRow = await HostProfile.query().where('user_id', userId).first()
    if (!hpRow) return response.badRequest('Host profile missing — apply first')

    const billable = (HostProfile as any)._billable
    const appUrl = (globalThis as any).process?.env?.APP_URL ?? 'http://localhost:3000'

    try {
      // Idempotent — returns the existing account on subsequent calls.
      await billable.createConnectAccount(hpRow, {
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        modelTable: 'host_profiles',
      })

      // Re-read so the link generator sees the freshly-stamped account id.
      const refreshed = await HostProfile.find(Number((hpRow as any)._attributes?.id ?? (hpRow as any).id))
      const link = await billable.connectOnboardLink(refreshed, {
        refreshUrl: `${appUrl}/host/dashboard?connect=refresh`,
        returnUrl: `${appUrl}/api/host/connect/return`,
      })
      return response.json(link)
    }
    catch (err) {
      return response.badRequest((err as Error).message)
    }
  },
})
