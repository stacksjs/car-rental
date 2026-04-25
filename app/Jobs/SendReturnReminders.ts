import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'

export default new Job({
  name: 'SendReturnReminders',
  description: 'Notify renters (email + sms + database) ~2h before their return',
  queue: 'default',
  tries: 3,
  backoff: 60,
  rate: Every.Hour,

  handle: async () => {
    const today = new Date().toISOString().slice(0, 10)
    const bookings = await Booking.query()
      .where('status', 'active')
      .where('end_date', today)
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
          subject: `Today: return your Drivly car (${b.reference})`,
          body: `Please return the car by ${b.return_time ?? 'the agreed time'}.`,
          data: { booking_id: b.id, reference: b.reference, kind: 'return_reminder' },
        },
        channels,
      )
      sent++
    }

    return { sent }
  },
})
