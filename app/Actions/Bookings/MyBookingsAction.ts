import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { authedUserId } from '../helpers/auth'

export default new Action({
  name: 'MyBookingsAction',
  description: "List the authed user's bookings, grouped by tab (upcoming/past/cancelled)",
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const today = new Date().toISOString().slice(0, 10)
    const all = await Booking.query()
      .where('user_id', userId)
      .orderBy('start_date', 'desc')
      .get()

    const data = (all as any[]).map(b => b._attributes ?? b)
    const upcoming = data.filter(b => b.status !== 'cancelled' && b.end_date >= today)
    const past = data.filter(b => b.status !== 'cancelled' && b.end_date < today)
    const cancelled = data.filter(b => b.status === 'cancelled')

    return response.json({ upcoming, past, cancelled, total: data.length })
  },
})
