export default new Action({
  name: 'CarShowBySlugAction',
  description: 'Fetch a car by id or slug (drivly URLs are slug-based)',
  method: 'GET',

  async handle(request: RequestInstance) {
    const key = (request as any).params?.key
    if (!key) return response.badRequest('key required')

    const asNum = Number(key)
    let carInstance: any | null = null
    if (Number.isFinite(asNum) && asNum > 0)
      carInstance = await Car.find(asNum)
    if (!carInstance)
      carInstance = await Car.query().where('slug', String(key)).first()
    if (!carInstance) return response.notFound('Car not found')

    // toAttrs() drops `hidden: true` attrs (license_plate, vin) which raw
    // _attributes spread would leak into the public response.
    const car = toAttrs<any>(carInstance)

    const photos = toAttrs(await CarPhoto.query()
      .where('car_id', Number(car.id))
      .orderBy('position', 'asc')
      .get())

    let host: any = null
    if (car.host_profile_id) {
      const hp = toAttrs<any>(await HostProfile.find(Number(car.host_profile_id)))
      if (hp) {
        const user = toAttrs<any>(await User.find(Number(hp.user_id)))
        host = {
          id: hp.id,
          name: user?.name,
          joinedAt: hp.joined_at,
          trips: hp.trips,
          rating: hp.rating,
          responseRate: hp.response_rate,
          responseTime: hp.response_time,
          verified: !!hp.verified,
          allStar: !!hp.all_star,
        }
      }
    }

    const location = car.location_id ? toAttrs(await Location.find(Number(car.location_id))) : null

    return response.json({ data: { ...car, photos, host, location } })
  },
})
