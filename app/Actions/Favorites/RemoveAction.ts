import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { authedUserId } from '../helpers/auth'

export default new Action({
  name: 'FavoritesRemoveAction',
  description: 'Remove a car from the authed user favorites',
  method: 'DELETE',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const carId = Number((request as any).params?.carId)
    const likeable = (User as any)._likeable
    try { await likeable?.unlike?.(userId, carId, 'cars') } catch { /* best effort */ }

    return response.json({ success: true, carId })
  },
})
