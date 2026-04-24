import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

import { log } from '@stacksjs/logging'

export default new Action({
  name: 'NotifyHostOfNewBooking',
  description: 'Pings the host when a new booking lands for one of their cars',

  async handle(booking: any) {
    const car = await Car.find(booking.car_id)
    const hostProfile = await HostProfile.find((car as any)?.host_profile_id)
    if (!hostProfile) return { success: false }
    const host = await User.find((hostProfile as any).user_id)
    log.info(`[booking] host ${(host as any)?.email} notified of ${booking.reference}`)
    return { success: true, host: (host as any)?.email }
  },
})
