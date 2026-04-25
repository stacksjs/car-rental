
export class ReviewPolicy {
  async view(_user: UserModel | null, _review: any): Promise<boolean> {
    return true
  }

  async create(user: UserModel | null, booking: any): Promise<boolean> {
    if (!user) return false
    if (!booking) return false
    if (booking.user_id !== (user as any).id) return false
    return booking.status === 'completed'
  }

  async update(user: UserModel | null, review: any): Promise<boolean> {
    if (!user) return false
    if ((user as any).role === 'admin') return true
    return review?.user_id === (user as any).id
  }

  async destroy(user: UserModel | null, review: any): Promise<boolean> {
    return this.update(user, review)
  }
}

export default new ReviewPolicy()
