export default new Action({
  name: 'HostConnectReturnAction',
  description: 'Callback after Stripe Connect onboarding; syncs capabilities',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.redirect('/login?next=/host/dashboard')

    const hp = await HostProfile.query().where('user_id', userId).first()
    if (!hp || !((hp as any)._attributes?.stripe_account_id ?? (hp as any).stripe_account_id))
      return response.redirect('/host/dashboard')

    try {
      const billable = (HostProfile as any)._billable
      await billable.syncConnectStatus(hp, { modelTable: 'host_profiles' })
    }
    catch { /* non-fatal — user can retry from dashboard */ }

    return response.redirect('/host/dashboard?connected=1')
  },
})
