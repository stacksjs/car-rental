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

    joinedAt: {
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

    responseRate: {
      order: 5,
      fillable: false,
      factory: faker => faker.number.int({ min: 80, max: 100 }),
    },

    responseTime: {
      order: 6,
      fillable: false,
      factory: faker => faker.helpers.arrayElement(['< 1 hour', '< 2 hours', '< 12 hours', '~ 24 hours']),
    },

    verified: {
      order: 7,
      fillable: false,
      factory: () => true,
    },

    allStar: {
      order: 8,
      fillable: false,
      factory: faker => faker.datatype.boolean({ probability: 0.6 }),
    },

    stripeAccountId: {
      order: 9,
      fillable: false,
      hidden: true,
      factory: () => null,
    },

    chargesEnabled: {
      order: 10,
      fillable: false,
      factory: () => false,
    },

    payoutsEnabled: {
      order: 11,
      fillable: false,
      factory: () => false,
    },

    platformFeeBps: {
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
