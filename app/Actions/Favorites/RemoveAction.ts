export default new Action({
  name: 'FavoritesRemoveAction',
  description: 'Remove a car from the authed user favorites',
  method: 'DELETE',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const carId = Number((request as any).params?.carId)
    const likeable = (Car as any)._likeable
    try {
      await likeable?.unlike?.(carId, userId)
    }
    catch {
      // best effort — unliking something that isn't liked shouldn't 500
    }

    return response.json({ success: true, carId })
  },
})
