async function resolveCar(idOrSlug: any): Promise<any | null> {
  if (idOrSlug == null) return null
  const asNum = Number(idOrSlug)
  if (Number.isFinite(asNum) && asNum > 0) {
    const byId = await Car.find(asNum)
    if (byId) return byId
  }
  return await Car.query().where('slug', String(idOrSlug)).first()
}

export default new Action({
  name: 'SimilarCarsAction',
  description: 'Return similar cars for a detail page (same category, excluding self)',
  method: 'GET',

  async handle(request: RequestInstance) {
    const key = (request as any).params?.id
    const limit = Math.min(Number(request.get('limit') ?? 6), 24)

    const car = toAttrs<any>(await resolveCar(key))
    if (!car) return response.notFound('Car not found')

    const rows = toAttrs<any[]>(await Car.query()
      .where('status', 'active')
      .where('category', car.category)
      .orderBy('rating', 'desc')
      .get())

    const data = rows
      .filter(c => Number(c.id) !== Number(car.id))
      .slice(0, limit)

    return response.json({ data })
  },
})
