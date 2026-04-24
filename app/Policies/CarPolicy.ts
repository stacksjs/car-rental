import type { UserModel } from '@stacksjs/orm'

export class CarPolicy {
  async view(_user: UserModel | null, _car: any): Promise<boolean> {
    return true
  }

  async create(user: UserModel | null): Promise<boolean> {
    const role = (user as any)?.role
    return role === 'host' || role === 'admin'
  }

  async update(user: UserModel | null, car: any): Promise<boolean> {
    if (!user) return false
    if ((user as any).role === 'admin') return true
    const hostProfileId = (user as any).host_profile?.id ?? (user as any).hostProfileId
    return hostProfileId != null && car?.host_profile_id === hostProfileId
  }

  async destroy(user: UserModel | null, car: any): Promise<boolean> {
    return this.update(user, car)
  }
}

export default new CarPolicy()
