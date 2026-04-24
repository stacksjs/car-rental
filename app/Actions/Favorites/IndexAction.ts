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

    // Read the likes pivot directly — the _likeable helper's shape varies
    // across framework versions; a raw query is the only resilient path.
    let carIds: number[] = []
    try {
      const { db } = await import('@stacksjs/database')
      const rows = await (db as any)
        .selectFrom('likes')
        .select(['likeable_id'])
        .where('user_id', '=', userId)
        .where('likeable_type', '=', 'cars')
        .execute()
      carIds = rows.map((r: any) => Number(r.likeable_id)).filter(Boolean)
    }
    catch {
      // `likes` table may not exist in some setups; return empty.
      return response.json({ data: [] })
    }

    const rows = carIds.length
      ? await Car.query().whereIn('id', carIds).get()
      : []
    const data = (rows as any[]).map(c => c._attributes ?? c)

    return response.json({ data })
  },
})
