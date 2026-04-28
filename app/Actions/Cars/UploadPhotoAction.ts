import { storage } from '@stacksjs/storage'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MiB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export default new Action({
  name: 'UploadPhotoAction',
  description: 'Upload a photo for a car (host-only)',
  method: 'POST',

  async handle(request: RequestInstance) {
    const carId = Number((request as any).params?.id)
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const car = toAttrs<any>(await Car.find(carId))
    if (!car) return response.notFound('Car not found')

    // Resolve the authed user's host_profile fresh — `request.user.host_profile`
    // isn't guaranteed to be hydrated by the auth middleware.
    const userRow = toAttrs<any>(await User.find(userId))
    const isAdmin = userRow?.role === 'admin'
    if (!isAdmin) {
      const hp = toAttrs<any>(await HostProfile.query().where('user_id', userId).first())
      if (!hp || Number(car.host_profile_id) !== Number(hp.id))
        return response.forbidden('Not your car')
    }

    const file = (request as any).file?.('photo') ?? (request as any).files?.photo
    if (!file) return response.badRequest('photo file required')

    // Defense in depth — reject oversized or non-image uploads BEFORE
    // touching disk. The browser's accept="image/*" hint isn't trusted.
    const declaredSize = Number((file as any).size ?? 0)
    if (declaredSize > MAX_PHOTO_BYTES)
      return response.badRequest(`Photo exceeds ${MAX_PHOTO_BYTES}-byte limit (got ${declaredSize})`)

    const declaredType = String((file as any).type ?? '').toLowerCase()
    if (declaredType && !ALLOWED_MIME.has(declaredType))
      return response.badRequest(`Unsupported photo type: ${declaredType}`)

    const disk = storage.disk?.('public') ?? storage
    const path = await disk.put(`cars/${carId}`, file)

    const existing = await CarPhoto.query().where('car_id', carId).count()
    const photo = await CarPhoto.create({
      car_id: carId,
      url: typeof path === 'string' ? path : (path as any).url,
      position: existing,
      is_primary: existing === 0,
    })

    return response.json({ data: toAttrs(photo) })
  },
})
