import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'

/**
 * Hourly nudge to drivers who got approved for a relocation but haven't
 * picked up the car yet — fires when the earliest_pickup_date is today.
 *
 * Mirrors SendPickupReminders for regular bookings; relocations are
 * separate because the lifecycle (claimed → in_progress) doesn't share
 * the booking status names.
 */
export default new Job({
  name: 'SendRelocationReminders',
  description: 'Notify approved drivers (email + database) on the morning of pickup',
  queue: 'default',
  tries: 3,
  backoff: 60,
  rate: Every.Hour,

  handle: async () => {
    const today = new Date().toISOString().slice(0, 10)
    const due = await Relocation.query()
      .where('status', 'claimed')
      .where('earliest_pickup_date', today)
      .get()

    let sent = 0
    for (const r of due as any[]) {
      const reloc: any = r._attributes ?? r
      if (!reloc.driver_id) continue
      const driver: any = await User.find(Number(reloc.driver_id))
      const driverAttrs = driver?._attributes ?? driver
      const email = driverAttrs?.email
      const channels: ('email' | 'database')[] = email ? ['email', 'database'] : ['database']
      try {
        await notify(
          { email, userId: reloc.driver_id },
          {
            subject: `Pickup today: relocate the car from ${String(reloc.pickup_address).split(',')[0]}`,
            body: `You're scheduled to pick up the car at ${reloc.pickup_address} today. Drop off at ${reloc.dropoff_address} by ${reloc.latest_dropoff_date}. Tap the relocation page to record the start odometer.`,
            data: { relocation_id: reloc.id, action: 'pickup' },
          },
          channels,
        )
        sent += 1
      }
      catch (err) {
        log.warn(`[job] SendRelocationReminders #${reloc.id} failed: ${(err as Error).message}`)
      }
    }

    log.info(`[job] SendRelocationReminders sent ${sent}/${(due as any[]).length}`)
    return { sent, total: (due as any[]).length }
  },
})
