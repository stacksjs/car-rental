
export class HostProfilePolicy {
  async view(_user: UserModel | null, _profile: any): Promise<boolean> {
    return true
  }

  async update(user: UserModel | null, profile: any): Promise<boolean> {
    if (!user) return false
    if ((user as any).role === 'admin') return true
    return profile?.user_id === (user as any).id
  }
}

export default new HostProfilePolicy()
