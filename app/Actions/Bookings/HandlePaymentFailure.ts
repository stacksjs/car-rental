import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'HandlePaymentFailure',
  description: 'Handle Stripe payment failures (log + optionally notify)',

  async handle(payload: any) {
    const bookingId = payload?.bookingId
    if (!bookingId) return { success: false }
    await Booking.update(bookingId, { status: 'pending' })
    return { success: true }
  },
})
