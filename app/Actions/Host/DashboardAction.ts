import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { authedUserId, resolveAuthedUser } from '../helpers/auth'

function attrs<T = any>(row: any): T { return (row?._attributes ?? row) as T }

export default new Action({
  name: 'HostDashboardAction',
  description: 'Host earnings + upcoming bookings + KPIs',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const userRaw = await resolveAuthedUser(request)
    const role = attrs<any>(userRaw)?.role
    if (role !== 'host' && role !== 'admin') return response.forbidden('Hosts only')

    const hpModel = await HostProfile.query().where('user_id', userId).first()
    if (!hpModel) return response.json({ empty: true })
    const hostProfile = attrs<any>(hpModel)

    const carRows = await Car.query().where('host_profile_id', hostProfile.id).get()
    const cars = (carRows as any[]).map(c => attrs<any>(c))
    const carIds = cars.map(c => Number(c.id))

    const bookingRows = carIds.length
      ? await Booking.query().whereIn('car_id', carIds).orderBy('start_date', 'desc').get()
      : []
    const bookings = (bookingRows as any[]).map(b => attrs<any>(b))

    const completed = bookings.filter(b => b.status === 'completed')
    const totalEarnings = completed.reduce((sum, b) => sum + Number(b.payout_amount ?? 0), 0)

    const today = new Date().toISOString().slice(0, 10)
    const upcoming = bookings.filter(b => b.status !== 'cancelled' && b.end_date >= today).slice(0, 8)

    const monthly: Record<string, number> = {}
    for (const b of completed) {
      const month = String(b.start_date).slice(0, 7)
      monthly[month] = (monthly[month] ?? 0) + Number(b.payout_amount ?? 0)
    }

    return response.json({
      kpis: {
        totalEarnings,
        activeListings: cars.filter(c => c.status === 'active').length,
        completionRate: completed.length / Math.max(1, bookings.length),
        totalTrips: Number(hostProfile.trips ?? 0),
        rating: Number(hostProfile.rating ?? 0),
      },
      monthly,
      upcoming,
      cars,
      chargesEnabled: !!hostProfile.charges_enabled,
      payoutsEnabled: !!hostProfile.payouts_enabled,
    })
  },
})
