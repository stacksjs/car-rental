import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Relocation = a one-way drive-away job that a host posts.
 *
 * The host needs their car moved from point A to point B (between dealership
 * branches, after a lease return, repositioning a fleet for the season,
 * etc.). The driver gets the car for the trip — and gets paid (flat fee,
 * per-mile, or "free" with perks like fuel allowance + free use for N
 * extra days). This is the same pattern used by Hertz/Enterprise's
 * "rental car relocation" programs and apps like JUCY's "drive-a-car".
 */
export default defineModel({
  name: 'Relocation',
  table: 'relocations',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'relocations_status_dates_index',
      columns: ['status', 'earliest_pickup_date', 'latest_dropoff_date'],
    },
    {
      name: 'relocations_host_status_index',
      columns: ['host_profile_id', 'status'],
    },
    {
      name: 'relocations_driver_status_index',
      columns: ['driver_id', 'status'],
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 6 },
    useApi: {
      uri: 'relocations',
      // GET (list/show) is open to the public. Writes/state transitions
      // run through the dedicated actions in app/Actions/Relocations/**
      // because they need ownership + role checks the auto-CRUD can't do.
      routes: ['index', 'show'],
    },
    useSearch: {
      displayable: [
        'id', 'status', 'pickup_address', 'dropoff_address',
        'earliest_pickup_date', 'latest_dropoff_date', 'estimated_distance_miles',
        'compensation_type', 'flat_fee', 'per_mile_rate', 'fuel_allowance',
        'max_extra_days', 'car_id', 'host_profile_id',
      ],
      searchable: ['pickup_address', 'dropoff_address', 'notes'],
      sortable: ['earliest_pickup_date', 'latest_dropoff_date', 'flat_fee', 'created_at'],
      filterable: ['status', 'compensation_type', 'host_profile_id', 'car_id'],
    },
    observe: true,
  },

  belongsTo: ['Car', 'HostProfile', 'User'],
  hasMany: ['RelocationApplication'],

  // Stamp host_profile_id from the authed user when a host POSTs without
  // an explicit value — same pattern as Car. Prevents one host from
  // accidentally posting a relocation under another host's id.
  authedFill: {
    creating: {
      host_profile_id: async (user: any) => {
        const userId = Number(user?._attributes?.id ?? user?.id)
        if (!userId) return null
        const hp = await HostProfile.query().where('user_id', userId).first() as any
        return hp ? Number(hp._attributes?.id ?? hp.id) : null
      },
    },
  },

  casts: {
    estimated_distance_miles: 'integer',
    flat_fee: 'integer',
    per_mile_rate: 'float',
    fuel_allowance: 'integer',
    max_extra_days: 'integer',
    min_age: 'integer',
    license_required: 'boolean',
    start_odometer: 'integer',
    end_odometer: 'integer',
    actual_miles_driven: 'integer',
    payout_amount: 'integer',
  },

  attributes: {
    car_id: { order: 1, fillable: true, factory: () => null },
    host_profile_id: { order: 2, fillable: true, factory: () => null },

    pickup_address: {
      order: 3,
      fillable: true,
      validation: { rule: schema.string().required().min(2).max(200) },
      factory: faker => `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    },
    pickup_location_id: { order: 4, fillable: true, factory: () => null },

    dropoff_address: {
      order: 5,
      fillable: true,
      validation: { rule: schema.string().required().min(2).max(200) },
      factory: faker => `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    },
    dropoff_location_id: { order: 6, fillable: true, factory: () => null },

    earliest_pickup_date: {
      order: 7,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.date.soon({ days: 14 }).toISOString().slice(0, 10),
    },
    latest_dropoff_date: {
      order: 8,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.date.soon({ days: 30, refDate: faker.date.soon({ days: 15 }) }).toISOString().slice(0, 10),
    },

    estimated_distance_miles: {
      order: 9,
      fillable: true,
      factory: faker => faker.number.int({ min: 80, max: 1800 }),
    },

    compensation_type: {
      order: 10,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.helpers.arrayElement(['flat', 'per_mile', 'free']),
    },
    flat_fee: { order: 11, fillable: true, factory: faker => faker.number.int({ min: 75, max: 600 }) },
    per_mile_rate: { order: 12, fillable: true, factory: faker => faker.number.float({ min: 0.25, max: 0.85, fractionDigits: 2 }) },
    fuel_allowance: { order: 13, fillable: true, factory: faker => faker.number.int({ min: 0, max: 200 }) },
    max_extra_days: { order: 14, fillable: true, factory: faker => faker.helpers.arrayElement([0, 1, 2, 3]) },

    min_age: {
      order: 15,
      fillable: true,
      validation: { rule: schema.number().min(18).max(99) },
      factory: () => 21,
    },
    license_required: { order: 16, fillable: true, factory: () => true },

    status: {
      order: 17,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: () => 'open',
    },

    notes: {
      order: 18,
      fillable: true,
      factory: faker => faker.lorem.sentences(2),
    },

    // Driver-trip lifecycle fields are intentionally `fillable: false` —
    // they only get set through the dedicated start/complete actions, so
    // mass-assignment via PATCH /api/relocations/:id can't fake a payout.
    driver_id: { order: 19, fillable: false, factory: () => null },
    started_at: { order: 20, fillable: false, factory: () => null },
    completed_at: { order: 21, fillable: false, factory: () => null },
    start_odometer: { order: 22, fillable: false, factory: () => null },
    end_odometer: { order: 23, fillable: false, factory: () => null },
    actual_miles_driven: { order: 24, fillable: false, factory: () => null },
    payout_amount: { order: 25, fillable: false, factory: () => null },
  },

  dashboard: { highlight: true },
} as const)
