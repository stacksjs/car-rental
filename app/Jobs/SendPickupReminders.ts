import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'

export default new Job({
  name: 'SendPickupReminders',
  description: 'Notify renters (email + sms + database) 24h before their pickup',
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

    let sent = 0
    for (const b of bookings as any[]) {
      const email = b.driver_email
      const phone = b.driver_phone
      const channels: ('email' | 'sms' | 'database')[] = ['database']
      if (email) channels.unshift('email')
      if (phone) channels.push('sms')

      await notify(
        { email, phone, userId: b.user_id },
        {
          subject: `Tomorrow: your Drivly pickup for ${b.reference}`,
          body: `Your pickup is at ${b.pickup_time ?? 'the agreed time'} on ${b.start_date}.`,
          data: { booking_id: b.id, reference: b.reference, kind: 'pickup_reminder' },
        },
        channels,
      )
      sent++
    }

    return { sent }
  },
})
