// Pure-function unit tests — intentionally use bun:test directly instead of
// @stacksjs/testing so we don't pay the multi-second cost of bootstrapping
// the whole framework runtime (auto-imports, ORM, env loading) for tests
// that don't touch a single one of those.
import { describe, expect, test } from 'bun:test'
import {
  addDaysISO,
  computePay,
  earliestNextPickup,
  estimateDriveDays,
  extractCity,
  normCity,
  snapshotLegFromRelocation,
} from '../../app/Actions/Roadtrips/_helpers'

describe('extractCity / normCity', () => {
  test('full street address pulls city out of the second-to-last comma part', () => {
    expect(extractCity('123 Main St, Los Angeles, CA')).toBe('los angeles')
    expect(extractCity('500 W 33rd St, New York, NY')).toBe('new york')
  })

  test('two-part address treats the first part as the city', () => {
    expect(extractCity('Phoenix, AZ')).toBe('phoenix')
  })

  test('lone city falls through normalised', () => {
    expect(extractCity('  Denver  ')).toBe('denver')
  })

  test('null / empty inputs collapse to empty string instead of throwing', () => {
    expect(extractCity(null)).toBe('')
    expect(extractCity(undefined)).toBe('')
    expect(extractCity('')).toBe('')
    expect(normCity(null)).toBe('')
  })
})

describe('computePay', () => {
  test('flat compensation = flat_fee + fuel_allowance', () => {
    expect(computePay({
      compensation_type: 'flat',
      flat_fee: 200,
      fuel_allowance: 60,
      estimated_distance_miles: 380,
    })).toBe(260)
  })

  test('per_mile uses estimated miles when actual is missing', () => {
    expect(computePay({
      compensation_type: 'per_mile',
      per_mile_rate: 0.5,
      fuel_allowance: 30,
      estimated_distance_miles: 400,
    })).toBe(230)
  })

  test('per_mile prefers actual_miles_driven when present (matches CompleteAction)', () => {
    expect(computePay({
      compensation_type: 'per_mile',
      per_mile_rate: 0.5,
      fuel_allowance: 30,
      estimated_distance_miles: 400,
      actual_miles_driven: 425,
    })).toBe(243) // round(0.5 * 425) + 30
  })

  test('free / unknown compensation pays only the fuel allowance', () => {
    expect(computePay({ compensation_type: 'free', fuel_allowance: 50 })).toBe(50)
    expect(computePay({ compensation_type: 'something_new', fuel_allowance: 25 })).toBe(25)
    expect(computePay({})).toBe(0)
  })
})

describe('estimateDriveDays', () => {
  test('rounds up at 500 mi/day, with a minimum of 1 day for any positive distance', () => {
    expect(estimateDriveDays(0)).toBe(1)
    expect(estimateDriveDays(100)).toBe(1)
    expect(estimateDriveDays(500)).toBe(1)
    expect(estimateDriveDays(501)).toBe(2)
    expect(estimateDriveDays(1500)).toBe(3)
    expect(estimateDriveDays(2750)).toBe(6)
  })

  test('handles null / negative / nonsense as zero (still returns 1 floor)', () => {
    expect(estimateDriveDays(null)).toBe(1)
    expect(estimateDriveDays(-100)).toBe(1)
  })
})

describe('addDaysISO / earliestNextPickup', () => {
  test('addDaysISO advances by N days in UTC', () => {
    expect(addDaysISO('2026-05-01', 0)).toBe('2026-05-01')
    expect(addDaysISO('2026-05-01', 3)).toBe('2026-05-04')
    // Crosses month boundary
    expect(addDaysISO('2026-05-30', 5)).toBe('2026-06-04')
    // Crosses year boundary
    expect(addDaysISO('2026-12-30', 5)).toBe('2027-01-04')
  })

  test('earliestNextPickup combines drive-time floor with prior pickup', () => {
    // 1500 mi → 3 days drive → earliest next pickup = pickup + 3
    expect(earliestNextPickup('2026-05-01', 1500)).toBe('2026-05-04')
    // 200 mi → 1 day floor
    expect(earliestNextPickup('2026-05-01', 200)).toBe('2026-05-02')
  })
})

describe('snapshotLegFromRelocation', () => {
  test('snapshots all pricing + window fields and computes estimated_pay', () => {
    const snap = snapshotLegFromRelocation({
      pickup_address: '123 Main St, Los Angeles, CA',
      dropoff_address: '789 Broadway, New York, NY',
      earliest_pickup_date: '2026-05-01',
      latest_dropoff_date: '2026-05-10',
      estimated_distance_miles: 2800,
      compensation_type: 'flat',
      flat_fee: 500,
      per_mile_rate: 0,
      fuel_allowance: 200,
      max_extra_days: 3,
    })
    expect(snap.from_address).toBe('123 Main St, Los Angeles, CA')
    expect(snap.from_city).toBe('los angeles')
    expect(snap.to_city).toBe('new york')
    expect(snap.compensation_type).toBe('flat')
    expect(snap.flat_fee).toBe(500)
    expect(snap.fuel_allowance).toBe(200)
    expect(snap.max_extra_days).toBe(3)
    // 500 + 200 = 700
    expect(snap.estimated_pay).toBe(700)
  })

  test('per_mile snapshot computes estimated_pay from estimated distance', () => {
    const snap = snapshotLegFromRelocation({
      pickup_address: 'A, City, ST',
      dropoff_address: 'B, City2, ST',
      earliest_pickup_date: '2026-05-01',
      latest_dropoff_date: '2026-05-04',
      estimated_distance_miles: 800,
      compensation_type: 'per_mile',
      per_mile_rate: 0.4,
      fuel_allowance: 50,
    })
    // round(0.4 * 800) + 50 = 320 + 50 = 370
    expect(snap.estimated_pay).toBe(370)
  })

  test('partial / null inputs default sanely to zero (no NaN propagation)', () => {
    const snap = snapshotLegFromRelocation({})
    expect(snap.from_address).toBe('')
    expect(snap.flat_fee).toBe(0)
    expect(snap.estimated_pay).toBe(0)
    expect(snap.max_extra_days).toBe(0)
  })
})
