import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CarShowBySlugAction',
  description: 'Fetch a car by id or slug (drivly URLs are slug-based)',
  method: 'GET',

  async handle(request: RequestInstance) {
    const key = (request as any).params?.key
    if (!key) return response.badRequest('key required')

    const asNum = Number(key)
    let car: any | null = null
    if (Number.isFinite(asNum) && asNum > 0)
      car = await Car.find(asNum)
    if (!car)
      car = await Car.query().where('slug', String(key)).first()
    if (!car) return response.notFound('Car not found')

    const photos = await CarPhoto.query()
      .where('car_id', Number(car.id))
      .orderBy('position', 'asc')
      .get()

    let host: any = null
    if (car.host_profile_id) {
      const hp = await HostProfile.find(Number(car.host_profile_id))
      if (hp) {
        const user = await User.find(Number((hp as any).user_id))
        host = {
          id: (hp as any).id,
          name: (user as any)?.name,
          joinedAt: (hp as any).joined_at,
          trips: (hp as any).trips,
          rating: (hp as any).rating,
          responseRate: (hp as any).response_rate,
          responseTime: (hp as any).response_time,
          verified: !!(hp as any).verified,
          allStar: !!(hp as any).all_star,
        }
      }
    }

    const location = car.location_id ? await Location.find(Number(car.location_id)) : null

    return response.json({ data: { ...car, photos, host, location } })
  },
})
