import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'HostProfile',
  table: 'host_profiles',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 8,
    },
    useApi: {
      uri: 'host-profiles',
      routes: ['show', 'update'],
    },
    observe: true,
    // Connect helpers — host_profile rows hold stripe_account_id +
    // charges_enabled + payouts_enabled. The billable trait now exposes
    // createConnectAccount / connectOnboardLink / syncConnectStatus on
    // hostProfile._billable so the host onboarding action is one call.
    billable: true,
  },

  belongsTo: ['User'],
  hasMany: ['Car'],

  // PATCH /api/host-profiles/{id} only succeeds when the row is the authed
  // user's own host profile (admins bypass).
  ownership: {
    field: 'user_id',
    resolve: async (user: any) => {
      const id = Number(user?._attributes?.id ?? user?.id)
      return id || null
    },
    bypass: (user: any) => (user?._attributes?.role ?? user?.role) === 'admin',
  },

  // SQLite stores booleans as text/int. Without casts, `!!"0"` evaluates to
  // true (non-empty string), so `!!hostProfile.charges_enabled` would lie
  // about a freshly-applied host who hasn't done Stripe Connect yet.
  casts: {
    verified: 'boolean',
    all_star: 'boolean',
    charges_enabled: 'boolean',
    payouts_enabled: 'boolean',
    trips: 'integer',
    rating: 'float',
    response_rate: 'integer',
    platform_fee_bps: 'integer',
  },

  attributes: {
    user_id: {
      order: 0,
      fillable: true,
      factory: () => null,
    },

    bio: {
      order: 1,
      fillable: true,
      factory: faker => faker.lorem.sentences(2),
    },

    joined_at: {
      order: 2,
      fillable: true,
      factory: faker => faker.date.past({ years: 4 }).toISOString(),
    },

    trips: {
      order: 3,
      fillable: false,
      factory: faker => faker.number.int({ min: 0, max: 600 }),
    },

    rating: {
      order: 4,
      fillable: false,
      factory: faker => faker.number.float({ min: 4.5, max: 5, fractionDigits: 2 }),
    },

    response_rate: {
      order: 5,
      fillable: false,
      factory: faker => faker.number.int({ min: 80, max: 100 }),
    },

    response_time: {
      order: 6,
      fillable: false,
      factory: faker => faker.helpers.arrayElement(['< 1 hour', '< 2 hours', '< 12 hours', '~ 24 hours']),
    },

    verified: {
      order: 7,
      fillable: false,
      factory: () => true,
    },

    all_star: {
      order: 8,
      fillable: false,
      factory: faker => faker.datatype.boolean({ probability: 0.6 }),
    },

    stripe_account_id: {
      order: 9,
      fillable: false,
      hidden: true,
      factory: () => null,
    },

    charges_enabled: {
      order: 10,
      fillable: false,
      factory: () => false,
    },

    payouts_enabled: {
      order: 11,
      fillable: false,
      factory: () => false,
    },

    platform_fee_bps: {
      order: 12,
      fillable: false,
      validation: {
        rule: schema.number().min(0).max(10000),
      },
      factory: () => 1500,
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
