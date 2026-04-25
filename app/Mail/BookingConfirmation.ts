import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'
import { url } from '@stacksjs/router'


export interface BookingConfirmationOptions {
  to: string
  reference: string
  start: string
  end: string
  total: number
  carName: string
}

export async function sendBookingConfirmation(options: BookingConfirmationOptions): Promise<void> {
  const appName = config.app.name || 'Drivly'

  const { html, text } = await template('booking-confirmation', {
    variables: options,
    subject: `Your ${appName} booking ${options.reference} is confirmed`,
  })

  await mail.send({
    to: [options.to],
    from: {
      name: config.email.from?.name || appName,
      address: config.email.from?.address || 'hello@drivly.app',
    },
    subject: `Your ${appName} booking ${options.reference} is confirmed`,
    html,
    text,
  })
}

export default sendBookingConfirmation
