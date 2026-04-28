import process from 'node:process'
import { schedule } from '@stacksjs/scheduler'

export default function () {
  schedule.job('Inspire').hourly().setTimeZone('America/Los_Angeles')

  schedule.job('SendPickupReminders').hourly().setTimeZone('America/Los_Angeles')
  schedule.job('SendReturnReminders').hourly().setTimeZone('America/Los_Angeles')
  schedule.job('SendRelocationReminders').hourly().setTimeZone('America/Los_Angeles')
  schedule.job('FinalizeBookings').daily().setTimeZone('America/Los_Angeles')
  schedule.job('ReindexCars').daily().setTimeZone('America/Los_Angeles')
}

process.on('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0))
})
