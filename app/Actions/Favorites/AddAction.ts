import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { authedUserId } from '../helpers/auth'

export default new Action({
  name: 'FavoritesAddAction',
  description: 'Add a car to the authed user favorites (likeable trait)',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const carId = Number((request as any).params?.carId)
    const car = await Car.find(carId)
    if (!car) return response.notFound('Car not found')

    const likeable = (User as any)._likeable
    try { await likeable?.like?.(userId, carId, 'cars') } catch { /* best effort */ }

    return response.json({ success: true, carId })
  },
})
