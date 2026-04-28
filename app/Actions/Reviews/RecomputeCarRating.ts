export default new Action({
  name: 'RecomputeCarRating',
  description: 'Recompute the Car aggregate rating + review_count after a new review',

  async handle(review: any) {
    if (!review?.car_id) return { success: false }

    const reviews = await Review.query().where('car_id', review.car_id).get()
    const count = (reviews as any[]).length
    const sum = (reviews as any[]).reduce((s, r) => s + Number(r.rating), 0)
    const avg = count ? Number((sum / count).toFixed(2)) : 0

    await Car.update(review.car_id, { rating: avg, review_count: count })
    return { success: true, car_id: review.car_id, rating: avg, count }
  },
})
