export default new Action({
  name: 'HostApplyAction',
  description: 'Apply to become a host (creates HostProfile, upgrades role)',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const existing = toAttrs<any>(await HostProfile.query().where('user_id', userId).first())
    if (existing) return response.json({ data: existing, already: true })

    // System counters (trips/rating/response_rate/etc.) are intentionally
    // `fillable: false` on the model so the auto-CRUD update endpoint can't
    // mass-assign them. That same guard means HostProfile.create() drops
    // them too — go through the underlying query builder so the new host
    // profile starts with the right defaults instead of NULLs that the
    // dashboard later has to paper over.
    //
    // Race protection: two concurrent /api/host/apply requests both pass the
    // `existing` check above, both try to INSERT, and only one wins thanks
    // to the unique index on host_profiles.user_id. The losing call gets a
    // SQLite UNIQUE constraint error — we catch it, re-read the row that
    // was created by the winning call, and return it as `already: true`.
    try {
      await db.insertInto('host_profiles')
        .values({
          user_id: userId,
          bio: String(request.get('bio') ?? ''),
          joined_at: new Date().toISOString(),
          trips: 0,
          rating: 5,
          response_rate: 100,
          response_time: '< 24 hours',
          verified: 0,
          all_star: 0,
          charges_enabled: 0,
          payouts_enabled: 0,
          platform_fee_bps: 1500,
          uuid: crypto.randomUUID(),
        })
        .execute()
    }
    catch (err) {
      const msg = String((err as Error)?.message ?? '')
      if (!/UNIQUE constraint failed.*host_profiles\.user_id/i.test(msg)) throw err
      const racedProfile = toAttrs<any>(await HostProfile.query().where('user_id', userId).first())
      if (racedProfile) return response.json({ data: racedProfile, already: true })
      throw err
    }
    const hostProfile = toAttrs<any>(await HostProfile.query().where('user_id', userId).first())

    await User.update(userId, { role: 'host' })

    return response.json({ data: hostProfile })
  },
})
