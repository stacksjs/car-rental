export default new Action({
  name: 'FavoritesAddAction',
  description: 'Add a car to the authed user favorites',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const carId = Number((request as any).params?.carId)
    const car = await Car.find(carId)
    if (!car) return response.notFound('Car not found')

    const likeable = (Car as any)._likeable
    if (!likeable?.like) return response.badRequest('likeable trait not wired')

    try {
      await likeable.like(carId, userId)
    }
    catch (err) {
      // Surface the underlying SQL/connection error so we can fix the cause.
      return response.json({ success: false, error: String((err as Error).message) }, 500)
    }

    return response.json({ success: true, carId })
  },
})
