export class PickupReminderNotification {
  constructor(private booking: any) {}

  via() {
    return ['email', 'sms', 'database']
  }

  toEmail() {
    return {
      subject: `Tomorrow: your Drivly pickup`,
      body: `Your pickup for ${this.booking.reference} is at ${this.booking.pickup_time} tomorrow.`,
    }
  }

  toSms() {
    return { body: `Drivly pickup tomorrow at ${this.booking.pickup_time}.` }
  }

  toDatabase() {
    return { type: 'pickup_reminder', data: { booking_id: this.booking.id } }
  }
}

export default PickupReminderNotification
