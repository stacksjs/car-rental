import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'
import { mail } from '@stacksjs/email'

export default new Job({
  name: 'SendPickupReminders',
  description: 'Email renters 24h before their pickup',
  queue: 'default',
  tries: 3,
  backoff: 60,
  rate: Every.Hour,

  handle: async () => {
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000)
    const window = in24h.toISOString().slice(0, 10)

    const bookings = await Booking.query()
      .where('status', 'confirmed')
      .where('start_date', window)
      .get()

    for (const b of bookings as any[]) {
      if (!b.driver_email) continue
      await mail.send({
        to: b.driver_email,
        subject: `Tomorrow: your Drivly pickup for ${b.reference}`,
        text: `Your pickup is at ${b.pickup_time} on ${b.start_date}.`,
      })
    }

    return { sent: (bookings as any[]).length }
  },
})
