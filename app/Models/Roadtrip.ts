import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Roadtrip = a user-planned multi-stop journey stitched together from
 * one or more open Relocations.
 *
 * Where a Relocation is a single point-A-to-point-B drive-away job,
 * a Roadtrip is the user's overall trip — say "LA → NYC" — and the
 * legs are the relocations that combine to cover it (e.g. LA → OKC
 * via one relocation, OKC → NYC via another). The trip belongs to
 * the user planning it; each leg's status mirrors the underlying
 * relocation's lifecycle.
 */
export default defineModel({
  name: 'Roadtrip',
  table: 'roadtrips',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'roadtrips_user_status_index',
      columns: ['user_id', 'status'],
    },
    {
      name: 'roadtrips_dates_index',
      columns: ['earliest_start_date', 'latest_end_date'],
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 4 },
    useApi: {
      uri: 'roadtrips',
      // Reads via dedicated actions so we can scope to the authed user.
      // Auto-CRUD here would expose every user's plans.
      routes: [],
    },
    observe: true,
  },

  belongsTo: ['User'],
  hasMany: ['RoadtripLeg'],

  // Roadtrips are personal — stamp user_id from the authed session so a
  // POST /api/roadtrips can't be forged for another account.
  authedFill: {
    creating: {
      user_id: async (user: any) => {
        const userId = Number(user?._attributes?.id ?? user?.id)
        return userId || null
      },
    },
  },

  casts: {
    user_id: 'integer',
    total_estimated_miles: 'integer',
  },

  attributes: {
    user_id: { order: 1, fillable: true, factory: () => null },

    title: {
      order: 2,
      fillable: true,
      validation: { rule: schema.string().max(200) },
      factory: faker => `${faker.location.city()} → ${faker.location.city()}`,
    },

    origin_address: {
      order: 3,
      fillable: true,
      validation: { rule: schema.string().required().min(2).max(200) },
      factory: faker => `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    },
    origin_city: {
      order: 4,
      fillable: true,
      factory: faker => faker.location.city(),
    },

    destination_address: {
      order: 5,
      fillable: true,
      validation: { rule: schema.string().required().min(2).max(200) },
      factory: faker => `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    },
    destination_city: {
      order: 6,
      fillable: true,
      factory: faker => faker.location.city(),
    },

    earliest_start_date: {
      order: 7,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.date.soon({ days: 14 }).toISOString().slice(0, 10),
    },
    latest_end_date: {
      order: 8,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.date.soon({ days: 30, refDate: faker.date.soon({ days: 15 }) }).toISOString().slice(0, 10),
    },

    total_estimated_miles: {
      order: 9,
      fillable: true,
      factory: faker => faker.number.int({ min: 200, max: 3500 }),
    },

    status: {
      order: 10,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: () => 'planning',
    },

    notes: {
      order: 11,
      fillable: true,
      factory: faker => faker.lorem.sentences(2),
    },
  },

  dashboard: { highlight: true },
} as const)
