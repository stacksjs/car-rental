/**
 * Host posts a new relocation. Requires the authed user to (a) be a host
 * and (b) own the car they're listing.
 *
 * Compensation has three shapes:
 *   - flat:     pays `flat_fee` regardless of distance
 *   - per_mile: pays `per_mile_rate * actual_miles_driven`
 *   - free:     no driver pay; perks like fuel allowance + max_extra_days
 *               compensate the driver via free use of the car.
 */

const VALID_COMPENSATION = new Set(['flat', 'per_mile', 'free'])

export default new Action({
  name: 'RelocationsStoreAction',
  description: 'Create a new relocation posting',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const hostProfile = toAttrs<any>(await HostProfile.query().where('user_id', userId).first())
    if (!hostProfile) return response.forbidden('Apply to host first')

    const carId = Number(request.get('car_id'))
    if (!carId) return response.badRequest('car_id is required')
    const car = toAttrs<any>(await Car.find(carId))
    if (!car) return response.notFound('Car not found')
    if (Number(car.host_profile_id) !== Number(hostProfile.id))
      return response.forbidden('You can only post relocations for your own cars')

    const compensationType = String(request.get('compensation_type') ?? '')
    if (!VALID_COMPENSATION.has(compensationType))
      return response.badRequest('compensation_type must be one of: flat, per_mile, free')

    const flatFee = Number(request.get('flat_fee') ?? 0)
    const perMileRate = Number(request.get('per_mile_rate') ?? 0)
    if (compensationType === 'flat' && !(flatFee > 0))
      return response.badRequest('flat_fee must be > 0 for flat compensation')
    if (compensationType === 'per_mile' && !(perMileRate > 0))
      return response.badRequest('per_mile_rate must be > 0 for per_mile compensation')

    const earliest = String(request.get('earliest_pickup_date') ?? '')
    const latest = String(request.get('latest_dropoff_date') ?? '')
    if (!earliest || !latest) return response.badRequest('earliest_pickup_date and latest_dropoff_date are required')
    if (latest < earliest) return response.badRequest('latest_dropoff_date cannot be before earliest_pickup_date')

    const pickupAddress = String(request.get('pickup_address') ?? '').trim()
    const dropoffAddress = String(request.get('dropoff_address') ?? '').trim()
    if (!pickupAddress || !dropoffAddress)
      return response.badRequest('pickup_address and dropoff_address are required')

    const reloc = await Relocation.create({
      car_id: carId,
      host_profile_id: Number(hostProfile.id),
      pickup_address: pickupAddress,
      dropoff_address: dropoffAddress,
      pickup_location_id: request.get('pickup_location_id') ? Number(request.get('pickup_location_id')) : null,
      dropoff_location_id: request.get('dropoff_location_id') ? Number(request.get('dropoff_location_id')) : null,
      earliest_pickup_date: earliest,
      latest_dropoff_date: latest,
      estimated_distance_miles: request.get('estimated_distance_miles') ? Number(request.get('estimated_distance_miles')) : null,
      compensation_type: compensationType,
      flat_fee: compensationType === 'flat' ? flatFee : 0,
      per_mile_rate: compensationType === 'per_mile' ? perMileRate : 0,
      fuel_allowance: Number(request.get('fuel_allowance') ?? 0),
      max_extra_days: Number(request.get('max_extra_days') ?? 0),
      min_age: Number(request.get('min_age') ?? 21),
      license_required: 1, // always required for now
      status: 'open',
      notes: String(request.get('notes') ?? ''),
    })

    const data = toAttrs<any>(reloc)
    dispatch('relocation:created', data)

    return response.json({ data })
  },
})
