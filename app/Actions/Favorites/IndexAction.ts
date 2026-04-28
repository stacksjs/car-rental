export default new Action({
  name: 'FavoritesIndexAction',
  description: 'List the authed user favorite cars',
  method: 'GET',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const likeable = (Car as any)._likeable
    let carIds: number[] = []
    try {
      carIds = await likeable?.likedBy?.(userId) ?? []
    }
    catch { return response.json({ data: [] }) }

    const data = carIds.length
      ? toAttrs(await Car.query().whereIn('id', carIds).get())
      : []

    return response.json({ data })
  },
})
