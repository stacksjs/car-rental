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
      joinedAt: new Date().toISOString(),
      trips: 0,
      rating: 5,
      responseRate: 100,
      responseTime: '< 24 hours',
      verified: false,
      allStar: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      platformFeeBps: 1500,
    })

    try {
      await User.update(userId, { role: 'host' })
    }
    catch { /* non-fatal — role update best-effort */ }

    const hpAttrs = (hostProfile as any)._attributes ?? hostProfile
    return response.json({ data: hpAttrs })
  },
})
