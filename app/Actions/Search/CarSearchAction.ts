import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CarSearchAction',
  description: 'Search and filter cars with facets + sort',
  method: 'GET',

  async handle(request: RequestInstance) {
    const q = String(request.get('q') ?? '').trim()
    const category = request.get('category') as string | undefined
    const make = request.get('make') as string | undefined
    const transmission = request.get('transmission') as string | undefined
    const fuelType = request.get('fuel') as string | undefined
    const seats = request.get('seats') ? Number(request.get('seats')) : undefined
    const minPrice = request.get('minPrice') ? Number(request.get('minPrice')) : undefined
    const maxPrice = request.get('maxPrice') ? Number(request.get('maxPrice')) : undefined
    const locationId = request.get('locationId') ? Number(request.get('locationId')) : undefined
    const instantBook = request.get('instantBook') === 'true'
    const deliveryAvailable = request.get('deliveryAvailable') === 'true'
    const sort = String(request.get('sort') ?? 'rating')
    const limit = Math.min(Number(request.get('limit') ?? 24), 96)
    const offset = Number(request.get('offset') ?? 0)

    let qb = Car.query().where('status', 'active')

    if (q) qb = qb.where((b: any) => b.where('make', 'like', `%${q}%`).orWhere('model', 'like', `%${q}%`).orWhere('trim', 'like', `%${q}%`).orWhere('description', 'like', `%${q}%`))
    if (category) qb = qb.where('category', category)
    if (make) qb = qb.where('make', make)
    if (transmission) qb = qb.where('transmission', transmission)
    if (fuelType) qb = qb.where('fuel_type', fuelType)
    if (seats) qb = qb.where('seats', '>=', seats)
    if (minPrice != null) qb = qb.where('daily_rate', '>=', minPrice)
    if (maxPrice != null) qb = qb.where('daily_rate', '<=', maxPrice)
    if (locationId) qb = qb.where('location_id', locationId)
    if (instantBook) qb = qb.where('instant_book', true)
    if (deliveryAvailable) qb = qb.where('delivery_available', true)

    const sortMap: Record<string, [string, 'asc' | 'desc']> = {
      rating: ['rating', 'desc'],
      priceAsc: ['daily_rate', 'asc'],
      priceDesc: ['daily_rate', 'desc'],
      newest: ['created_at', 'desc'],
    }
    const [sortCol, sortDir] = sortMap[sort] ?? sortMap.rating
    qb = qb.orderBy(sortCol, sortDir)

    const total = await Car.query().where('status', 'active').count()
    const data = await qb.limit(limit).offset(offset).get()

    return response.json({ data, meta: { total, limit, offset } })
  },
})
