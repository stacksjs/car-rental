/**
 * /me — authed user profile, augmented with host context.
 *
 * The framework default AuthUserAction returns just the user row. SPAs
 * then hit /api/host/dashboard to know whether to render host UI, which
 * adds a needless extra round-trip on every page load. Returning the
 * `host_profile` (when one exists) here means navbar/menu hydration is
 * a single request.
 */

export default new Action({
  name: 'MeAction',
  description: 'Authed user + host_profile + favorite count',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const user = toAttrs<any>(await User.find(userId))
    if (!user) return response.notFound('User not found')

    const hp = toAttrs<any>(await HostProfile.query().where('user_id', userId).first())

    // Strip sensitive fields the SPA never needs. `User` already declares
    // `password` + `license_number` as `hidden: true` so toAttrs already
    // dropped them, but be explicit so a future un-hide doesn't leak.
    const { password: _pw, license_number: _ln, ...safe } = user

    return response.json({
      ...safe,
      host_profile: hp ? {
        id: hp.id,
        bio: hp.bio,
        verified: !!hp.verified,
        all_star: !!hp.all_star,
        charges_enabled: !!hp.charges_enabled,
        payouts_enabled: !!hp.payouts_enabled,
        rating: Number(hp.rating ?? 0),
        trips: Number(hp.trips ?? 0),
      } : null,
      is_host: !!hp,
      is_admin: user.role === 'admin',
    })
  },
})
