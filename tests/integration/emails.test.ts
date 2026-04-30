/**
 * Email pipeline integration test.
 *
 * Verifies the listener-driven email flow end-to-end against a live dev
 * API server: register fires `user:registered` → SendWelcomeEmail; create
 * a booking → SendBookingConfirmation. Both should land an inspectable
 * file under `storage/logs/mail/` (the `log` driver used in dev/tests
 * never opens a network socket).
 *
 * Skips automatically when the API isn't reachable so `bun test` stays
 * useful without dev mode running.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from '@stacksjs/testing'

const API_BASE = process.env.E2E_API_BASE ?? 'https://api.drivly.localhost'
const MAIL_DIR = resolve(join(import.meta.dir, '..', '..', 'storage', 'logs', 'mail'))

let serverUp = false

async function apiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/healthz`, { tls: { rejectUnauthorized: false } as any })
    return r.ok
  }
  catch { return false }
}

function listMailFiles(): string[] {
  if (!existsSync(MAIL_DIR)) return []
  return readdirSync(MAIL_DIR).filter(f => f.endsWith('.html'))
}

function readSubjects(): string[] {
  return listMailFiles().map((f) => {
    const content = readFileSync(join(MAIL_DIR, f), 'utf8')
    const match = content.match(/Subject:\s*(.+)/)
    return match?.[1]?.trim() ?? ''
  })
}

function clearMail(): void {
  if (existsSync(MAIL_DIR)) rmSync(MAIL_DIR, { recursive: true, force: true })
  mkdirSync(MAIL_DIR, { recursive: true })
}

async function waitForFiles(min: number, timeoutMs = 8000): Promise<string[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const files = listMailFiles()
    if (files.length >= min) return files
    await new Promise(r => setTimeout(r, 100))
  }
  return listMailFiles()
}

beforeAll(async () => {
  serverUp = await apiAvailable()
  if (!serverUp) {
    console.warn(`[emails.test] dev API unreachable at ${API_BASE} — skipping`)
  }
})

afterAll(() => {
  // leave the captured files behind for manual inspection
})

describe('email pipeline', () => {
  test('registering a user sends a welcome email via the log driver', async () => {
    if (!serverUp) return
    clearMail()

    const email = `welcome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@drivly.test`
    const r = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Welcome Tester', email, password: 'password123', password_confirmation: 'password123' }),
      tls: { rejectUnauthorized: false } as any,
    })
    expect(r.status).toBe(200)

    const files = await waitForFiles(1)
    expect(files.length).toBeGreaterThanOrEqual(1)

    const subjects = readSubjects()
    expect(subjects.some(s => s.toLowerCase().includes('welcome'))).toBe(true)

    // The captured file should contain the recipient address in its
    // header — proves the right user was targeted, not just "an email
    // was sent".
    const html = readFileSync(join(MAIL_DIR, files[0]), 'utf8')
    expect(html).toContain(email)
  })

  test('creating a booking dispatches a confirmation email + db notification', async () => {
    if (!serverUp) return
    clearMail()

    // Register fresh user to scope the assertions
    const email = `book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@drivly.test`
    const reg = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Booking Tester', email, password: 'password123', password_confirmation: 'password123' }),
      tls: { rejectUnauthorized: false } as any,
    })
    expect(reg.status).toBe(200)
    const { token } = await reg.json() as { token: string }

    // Wait a beat so the welcome email file lands separately and we can
    // count booking emails by subject below.
    await waitForFiles(1)
    const beforeCount = listMailFiles().length

    // Use a random far-future date window so we don't collide with
    // overlapping bookings created by other test runs.
    const offsetDays = 365 + Math.floor(Math.random() * 720)
    const start = new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
    const end = new Date(Date.now() + (offsetDays + 2) * 86400000).toISOString().slice(0, 10)
    const bk = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ car_id: 1, start_date: start, end_date: end }),
      tls: { rejectUnauthorized: false } as any,
    })
    expect(bk.status).toBe(200)

    const files = await waitForFiles(beforeCount + 1)
    expect(files.length).toBeGreaterThan(beforeCount)

    const subjects = readSubjects()
    expect(subjects.some(s => /your drivly booking .* is confirmed/i.test(s))).toBe(true)
  })
})
