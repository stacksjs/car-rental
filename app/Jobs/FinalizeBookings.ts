import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'
import { dispatch } from '@stacksjs/events'


export default new Job({
  name: 'FinalizeBookings',
  description: 'Flip bookings that have completed to completed status and dispatch review request',
  queue: 'default',
  tries: 3,
  backoff: 300,
  rate: Every.Day,

  handle: async () => {
    const today = new Date().toISOString().slice(0, 10)
    const due = await Booking.query()
      .whereIn('status', ['confirmed', 'active'])
      .where('end_date', '<', today)
      .get()

    for (const b of due as any[]) {
      await Booking.update(b.id, { status: 'completed' })
      const updated = await Booking.find(b.id)
      dispatch('booking:completed', updated)
    }

    return { finalized: (due as any[]).length }
  },
})
