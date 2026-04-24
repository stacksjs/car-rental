import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { authedUserId } from '../helpers/auth'

export default new Action({
  name: 'HostApplyAction',
  description: 'Apply to become a host (creates HostProfile, upgrades role)',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const existing = await HostProfile.query().where('user_id', userId).first()
    if (existing) {
      const attrs = (existing as any)._attributes ?? existing
      return response.json({ data: attrs, already: true })
    }

    const hostProfile = await HostProfile.create({
      user_id: userId,
      bio: String(request.get('bio') ?? ''),
      joined_at: new Date().toISOString(),
      trips: 0,
      rating: 5,
      response_rate: 100,
      response_time: '< 24 hours',
      verified: false,
      all_star: false,
      charges_enabled: false,
      payouts_enabled: false,
      platform_fee_bps: 1500,
    })

    try {
      // User.update respects fillable + may reject partial writes; fall back
      // to a raw UPDATE to ensure role actually flips to 'host'.
      const { db } = await import('@stacksjs/database')
      await (db as any).updateTable('users')
        .set({ role: 'host', updated_at: new Date().toISOString() })
        .where('id', '=', userId)
        .execute()
    }
    catch { /* non-fatal — role update best-effort */ }

    const hpAttrs = (hostProfile as any)._attributes ?? hostProfile
    return response.json({ data: hpAttrs })
  },
})
