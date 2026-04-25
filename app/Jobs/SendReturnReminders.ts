import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'
import { mail, template } from '@stacksjs/email'


export default new Job({
  name: 'SendReturnReminders',
  description: 'Email renters ~2h before their return',
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

    for (const b of bookings as any[]) {
      if (!b.driver_email) continue
      await mail.send({
        to: b.driver_email,
        subject: `Today: return your Drivly car (${b.reference})`,
        text: `Please return the car by ${b.return_time}.`,
      })
    }

    return { sent: (bookings as any[]).length }
  },
})
