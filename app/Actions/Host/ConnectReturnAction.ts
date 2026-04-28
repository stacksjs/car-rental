/**
 * Stripe Connect onboarding return URL — runs after the host completes
 * (or partially completes) the Stripe-hosted KYC flow.
 *
 * NOT auth-gated: Stripe redirects the user's browser here directly and
 * doesn't preserve our bearer token. Instead we recover the host_profile
 * via the `acct` query param, which ConnectOnboardingAction stamps onto
 * the returnUrl when it generates the AccountLink. The handler only
 * triggers a Stripe→DB capability sync, so even an attacker hitting this
 * URL with a guessed account id just causes us to pull truthful state
 * from Stripe — no impersonation risk.
 *
 * After the sync we redirect to the dashboard, which is auth-gated client-
 * side and will show a re-login prompt if the user's session expired.
 */

export default new Action({
  name: 'HostConnectReturnAction',
  description: 'Callback after Stripe Connect onboarding; syncs capabilities',
  method: 'GET',

  async handle(request: RequestInstance) {
    const acct = String(request.get('acct') ?? '').trim()

    let hp: any = null
    if (acct) {
      hp = await HostProfile.query().where('stripe_account_id', acct).first()
    }
    else {
      // Fallback for users with a still-valid bearer token (e.g. SPA-driven
      // testing) — keeps the legacy flow working without breaking the
      // Stripe-redirect path.
      const userId = await authedUserId(request).catch(() => null)
      if (userId) hp = await HostProfile.query().where('user_id', userId).first()
    }

    const hpAttrs = toAttrs<any>(hp)
    if (!hpAttrs?.stripe_account_id) return response.redirect('/host/dashboard')

    try {
      const billable = (HostProfile as any)._billable
      await billable.syncConnectStatus(hp, { modelTable: 'host_profiles' })
    }
    catch { /* non-fatal — user can retry from dashboard */ }

    return response.redirect('/host/dashboard?connected=1')
  },
})
