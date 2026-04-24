import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'DrivlyPlusSubscribeAction',
  description: 'Start/resume a Drivly+ subscription checkout session',
  method: 'POST',

  async handle(request: RequestInstance) {
    const user = (request as any).user
    if (!user) return response.unauthorized('Auth required')

    const priceId = String(request.get('price_id') ?? (globalThis as any).process?.env?.DRIVLY_PLUS_PRICE_ID ?? '')
    if (!priceId) return response.badRequest('price_id required')

    const billable = (user as any)._billable
    if (!billable?.newSubscription) {
      return response.badRequest('billable trait unavailable')
    }

    const result = await billable.newSubscription((user as any).id, 'drivly-plus', priceId)
    return response.json({ data: result })
  },
})
