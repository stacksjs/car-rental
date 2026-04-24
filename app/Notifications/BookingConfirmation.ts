export class BookingConfirmationNotification {
  constructor(private booking: any) {}

  via() {
    return ['email', 'database']
  }

  toEmail() {
    return {
      subject: `Booking ${this.booking.reference} confirmed`,
      body: `Your booking ${this.booking.reference} is confirmed.`,
    }
  }

  toDatabase() {
    return {
      type: 'booking_confirmed',
      data: { booking_id: this.booking.id, reference: this.booking.reference },
    }
  }
}

export default BookingConfirmationNotification
