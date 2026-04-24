import type { UserModel } from '@stacksjs/orm'

export class BookingPolicy {
  async view(user: UserModel | null, booking: any): Promise<boolean> {
    if (!user) return false
    if ((user as any).role === 'admin') return true
    if (booking?.user_id === (user as any).id) return true
    const hostProfileId = (user as any).host_profile?.id ?? (user as any).hostProfileId
    return hostProfileId != null && booking?.car?.host_profile_id === hostProfileId
  }

  async create(user: UserModel | null): Promise<boolean> {
    return user != null
  }

  async update(user: UserModel | null, booking: any): Promise<boolean> {
    return this.view(user, booking)
  }

  async cancel(user: UserModel | null, booking: any): Promise<boolean> {
    if (!user) return false
    if ((user as any).role === 'admin') return true
    if (booking?.status === 'completed' || booking?.status === 'cancelled') return false
    return booking?.user_id === (user as any).id
  }
}

export default new BookingPolicy()
