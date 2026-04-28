import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Booking',
  table: 'bookings',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'bookings_car_dates_index',
      columns: ['car_id', 'start_date', 'end_date'],
    },
    {
      name: 'bookings_user_status_index',
      columns: ['user_id', 'status'],
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 30,
    },
    useApi: {
      uri: 'bookings',
      // No `index` — auto-CRUD's index can't scope to "the authed user's
      // bookings" without a per-model authz layer. The /api/bookings/mine
      // action is the user-scoped equivalent and already exists.
      // No `destroy` — bookings are cancelled (status=cancelled), not deleted.
      routes: ['store', 'show', 'update'],
    },
    useSearch: {
      displayable: ['id', 'reference', 'status', 'start_date', 'end_date', 'total'],
      searchable: ['reference', 'driver_first_name', 'driver_last_name', 'driver_email'],
      sortable: ['start_date', 'end_date', 'total', 'created_at'],
      filterable: ['status', 'car_id', 'user_id', 'protection_plan'],
    },
    observe: true,
  },

  belongsTo: ['Car', 'User'],
  belongsToMany: ['Extra'],
  hasMany: ['Review'],

  // The renter owns the booking — only they (or an admin) can PATCH it
  // through the auto-CRUD update endpoint.
  ownership: {
    field: 'user_id',
    resolve: async (user: any) => Number(user?._attributes?.id ?? user?.id) || null,
    bypass: (user: any) => (user?._attributes?.role ?? user?.role) === 'admin',
  },

  casts: {
    subtotal: 'integer',
    protection_fee: 'integer',
    extras_fee: 'integer',
    taxes: 'integer',
    total: 'integer',
    platform_fee: 'integer',
    payout_amount: 'integer',
  },

  attributes: {
    reference: {
      unique: true,
      order: 1,
      fillable: true,
      validation: { rule: schema.string().required().max(20) },
      factory: faker => `DRV-${faker.string.numeric(6)}`,
    },

    car_id: { order: 2, fillable: true, factory: () => null },
    user_id: { order: 3, fillable: true, factory: () => null },

    status: {
      order: 4,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.helpers.arrayElement(['pending', 'confirmed', 'active', 'completed', 'cancelled']),
    },

    start_date: {
      order: 5,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.date.soon({ days: 60 }).toISOString().slice(0, 10),
    },

    end_date: {
      order: 6,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.date.soon({ days: 90, refDate: faker.date.soon({ days: 61 }) }).toISOString().slice(0, 10),
    },

    pickup_time: { order: 7, fillable: true, factory: () => '10:00' },
    return_time: { order: 8, fillable: true, factory: () => '10:00' },
    pickup_location: { order: 9, fillable: true, factory: () => 'host' },
    delivery_address: { order: 10, fillable: true, factory: () => null },

    protection_plan: {
      order: 11,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.helpers.arrayElement(['minimum', 'standard', 'premium']),
    },

    subtotal: { order: 12, fillable: true, factory: faker => faker.number.int({ min: 100, max: 5000 }) },
    protection_fee: { order: 13, fillable: true, factory: faker => faker.number.int({ min: 0, max: 500 }) },
    extras_fee: { order: 14, fillable: true, factory: () => 0 },
    taxes: { order: 15, fillable: true, factory: faker => faker.number.int({ min: 10, max: 400 }) },

    total: {
      order: 16,
      fillable: true,
      validation: { rule: schema.number().required().min(0) },
      factory: faker => faker.number.int({ min: 120, max: 6000 }),
    },

    platform_fee: { order: 17, fillable: true, factory: () => 0 },
    payout_amount: { order: 18, fillable: true, factory: () => 0 },

    driver_first_name: { order: 19, fillable: true, factory: faker => faker.person.firstName() },
    driver_last_name: { order: 20, fillable: true, factory: faker => faker.person.lastName() },
    driver_email: {
      order: 21,
      fillable: true,
      validation: { rule: schema.string().email() },
      factory: faker => faker.internet.email(),
    },
    driver_phone: { order: 22, fillable: true, factory: faker => faker.phone.number() },
    driver_dob: {
      order: 23,
      fillable: true,
      factory: faker => faker.date.birthdate({ min: 21, max: 70, mode: 'age' }).toISOString().slice(0, 10),
    },
    driver_license: { order: 24, hidden: true, fillable: true, factory: faker => faker.string.alphanumeric(10).toUpperCase() },
    driver_license_state: { order: 25, fillable: true, factory: faker => faker.location.state({ abbreviated: true }) },

    payment_method: { order: 26, fillable: true, factory: () => 'card' },
    payment_intent_id: { order: 27, fillable: false, hidden: true, factory: () => null },
    cancellation_reason: { order: 28, fillable: true, factory: () => null },
  },

  dashboard: { highlight: true },
} as const)
