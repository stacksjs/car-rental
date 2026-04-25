export default new Action({
  name: 'RequestReview',
  description: 'After a completed trip, ping the renter on email + inbox to leave a review',

  async handle(booking: any) {
    const email = booking?.driver_email
    if (!email && !booking?.user_id) return { success: false }

    await notify(
      { email, userId: booking.user_id },
      {
        subject: 'How was your Drivly trip?',
        body: `Your trip ${booking.reference} just wrapped. Tap here to leave a review.`,
        data: { booking_id: booking.id, reference: booking.reference, action: 'review' },
      },
      ['email', 'database'],
    )

    return { success: true }
  },
})
