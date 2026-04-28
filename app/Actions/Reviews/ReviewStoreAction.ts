/**
 * Renter posts a review against a completed booking.
 *
 * Guards:
 *   - The renter must be the booking's owner.
 *   - The booking must be `completed` (no leaving reviews mid-trip).
 *   - One review per (booking) — re-reviewing the same booking returns the
 *     existing row instead of creating a duplicate.
 *
 * On success, dispatches `review:created` so RecomputeCarRating updates the
 * Car's aggregate rating + review_count.
 */

export default new Action({
  name: 'ReviewStoreAction',
  description: 'Renter creates a review for a completed booking',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const bookingId = Number(request.get('booking_id'))
    const rating = Number(request.get('rating'))
    const body = String(request.get('body') ?? '').trim()

    if (!bookingId) return response.badRequest('booking_id is required')
    if (!(rating >= 1 && rating <= 5)) return response.badRequest('rating must be 1–5')
    if (body.length < 10) return response.badRequest('review body must be at least 10 characters')

    const booking = toAttrs<any>(await Booking.find(bookingId))
    if (!booking) return response.notFound('Booking not found')
    if (Number(booking.user_id) !== Number(userId))
      return response.forbidden('You can only review your own bookings')
    if (booking.status !== 'completed')
      return response.badRequest('You can only review a completed booking')

    // One review per booking. Re-submission updates the existing row's
    // rating/body — drivers fix typos, don't duplicate the entry.
    const existing = toAttrs<any>(await Review.query().where('booking_id', bookingId).first())
    let review: any
    if (existing) {
      review = toAttrs<any>(await Review.update(existing.id, { rating, body }))
    }
    else {
      review = toAttrs<any>(await Review.create({
        car_id: booking.car_id,
        booking_id: bookingId,
        user_id: userId,
        rating,
        body,
      }))
    }

    dispatch('review:created', review)
    return response.json({ data: review })
  },
})
