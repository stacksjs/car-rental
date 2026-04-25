export default new Action({
  name: 'RequestReview',
  description: 'After a completed trip, email the renter asking for a review',

  async handle(booking: any) {
    if (!booking?.driver_email) return { success: false }
    await mail.send({
      to: booking.driver_email,
      subject: `How was your Drivly trip?`,
      text: `Your trip ${booking.reference} just wrapped. Tap here to leave a review.`,
    })
    return { success: true }
  },
})
