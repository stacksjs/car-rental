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
      const hpAttrs = toAttrs<any>(hpRow)
      const refreshed = await HostProfile.find(Number(hpAttrs.id))
      const refreshedAttrs = toAttrs<any>(refreshed)

      // Stripe browser-redirects back here without our bearer token, so we
      // include the freshly-stamped account id in the return URL and the
      // ConnectReturnAction looks the host_profile up by it. The endpoint
      // only triggers a Stripe→DB capability sync, so the worst a stranger
      // can do is pull truthful state from Stripe — no impersonation risk.
      const acct = refreshedAttrs?.stripe_account_id
      const returnUrl = acct
        ? `${appUrl}/api/host/connect/return?acct=${encodeURIComponent(acct)}`
        : `${appUrl}/api/host/connect/return`

      const link = await billable.connectOnboardLink(refreshed, {
        refreshUrl: `${appUrl}/host/dashboard?connect=refresh`,
        returnUrl,
      })
      return response.json(link)
    }
    catch (err) {
      return response.badRequest((err as Error).message)
    }
  },
})
