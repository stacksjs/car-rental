/**
 * Thin API client used by stx views.
 *
 * Attaches the bearer token from localStorage (set by the session store) and
 * serialises JSON responses. Throws a structured error on non-2xx.
 */

const TOKEN_KEY = 'drivly-token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function getToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  }
  catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  }
  catch { /* noop */ }

  // Mirror the token into a cookie so the server-side stx middleware
  // can gate protected pages on the *initial* request (before any
  // client JS runs). Not HttpOnly because it's the same value the
  // client already trusts via localStorage.
  try {
    if (typeof document === 'undefined') return
    if (token)
      document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
    else
      document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
  }
  catch { /* noop */ }
}

export interface ApiError extends Error {
  status: number
  payload?: unknown
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers as HeadersInit)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json')
  headers.set('Accept', 'application/json')

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(path.startsWith('http') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
  })

  const body = res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const err: ApiError = Object.assign(new Error(`API ${res.status}: ${path}`), { status: res.status, payload: body })
    throw err
  }

  return body as T
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' })
}

export function apiPost<T = unknown>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined })
}

export function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' })
}
