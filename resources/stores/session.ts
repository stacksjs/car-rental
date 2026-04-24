import { defineStore } from 'stx'
import { apiPost, setToken } from './api'

interface SessionUser {
  id: number | string
  name: string
  email: string
  avatar?: string
  role: 'guest' | 'host' | 'admin'
}

export const useSession = defineStore('session', () => {
  const user = state<SessionUser | null>(null)
  const isAuthenticated = derived(() => user() !== null)
  const isHost = derived(() => user()?.role === 'host' || user()?.role === 'admin')

  async function login(email: string, password: string) {
    const res = await apiPost<{ token: string, user: SessionUser }>('/auth/login', { email, password })
    setToken(res.token)
    const initials = (res.user?.name ?? email).split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
    user.set({ ...res.user, avatar: res.user?.avatar ?? initials, role: res.user?.role ?? 'guest' })
    return res.user
  }

  async function register(name: string, email: string, password: string) {
    await apiPost('/auth/register', { name, email, password })
    return login(email, password)
  }

  async function logout() {
    try { await apiPost('/auth/logout') } catch { /* noop */ }
    setToken(null)
    user.set(null)
  }

  function setUser(next: SessionUser | null) {
    user.set(next)
  }

  return { user, isAuthenticated, isHost, login, register, logout, setUser }
}, {
  persist: { pick: ['user'], key: 'drivly-session' },
})
