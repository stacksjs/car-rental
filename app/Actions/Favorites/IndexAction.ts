import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { authedUserId } from '../helpers/auth'

export default new Action({
  name: 'FavoritesIndexAction',
  description: 'List the authed user favorite cars',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const likeable = (User as any)._likeable
    let carIds: number[] = []
    try { carIds = (await likeable?.likedIds?.(userId, 'cars')) ?? [] } catch { /* */ }

    const rows = carIds.length
      ? await Car.query().whereIn('id', carIds).get()
      : []
    const data = (rows as any[]).map(c => c._attributes ?? c)

    return response.json({ data })
  },
})
