import { storage } from '@stacksjs/storage'

export default new Action({
  name: 'UploadPhotoAction',
  description: 'Upload a photo for a car (host-only)',
  method: 'POST',

  async handle(request: RequestInstance) {
    const carId = Number((request as any).params?.id)
    const user = (request as any).user
    if (!user) return response.unauthorized('Auth required')

    const car = await Car.find(carId)
    if (!car) return response.notFound('Car not found')

    const hostProfileId = (user as any).host_profile?.id
    const isAdmin = (user as any).role === 'admin'
    if (!isAdmin && ((car as any).host_profile_id !== hostProfileId)) {
      return response.forbidden('Not your car')
    }

    const file = (request as any).file?.('photo') ?? (request as any).files?.photo
    if (!file) return response.badRequest('photo file required')

    const disk = storage.disk?.('public') ?? storage
    const path = await disk.put(`cars/${carId}`, file)

    const existing = await CarPhoto.query().where('car_id', carId).count()
    const photo = await CarPhoto.create({
      car_id: carId,
      url: typeof path === 'string' ? path : (path as any).url,
      position: existing,
      isPrimary: existing === 0,
    })

    return response.json({ data: photo })
  },
})
