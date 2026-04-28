import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * RoadtripLeg = one segment of a Roadtrip, backed by a Relocation.
 *
 * Sequence ordering is per-roadtrip (0-based). The from_X / to_X fields
 * are snapshotted off the underlying Relocation at add-time so the
 * trip view stays stable even if the relocation's address text
 * changes later. status mirrors the leg's relocation lifecycle:
 *   - planned   :: leg added, no application yet
 *   - applied   :: driver has applied to the underlying relocation
 *   - approved  :: host accepted the driver for this relocation
 *   - in_progress :: driver started the relocation trip
 *   - completed :: relocation completed
 *   - cancelled :: leg removed or relocation cancelled
 */
export default defineModel({
  name: 'RoadtripLeg',
  table: 'roadtrip_legs',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'roadtrip_legs_roadtrip_sequence_index',
      columns: ['roadtrip_id', 'sequence'],
    },
    {
      name: 'roadtrip_legs_relocation_index',
      columns: ['relocation_id'],
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'roadtrip-legs',
      routes: [],
    },
    observe: true,
  },

  belongsTo: ['Roadtrip', 'Relocation'],

  casts: {
    roadtrip_id: 'integer',
    relocation_id: 'integer',
    sequence: 'integer',
    estimated_distance_miles: 'integer',
  },

  attributes: {
    roadtrip_id: { order: 1, fillable: true, factory: () => null },
    relocation_id: { order: 2, fillable: true, factory: () => null },

    sequence: {
      order: 3,
      fillable: true,
      validation: { rule: schema.number().required().min(0) },
      factory: () => 0,
    },

    from_address: {
      order: 4,
      fillable: true,
      factory: faker => `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    },
    from_city: {
      order: 5,
      fillable: true,
      factory: faker => faker.location.city(),
    },

    to_address: {
      order: 6,
      fillable: true,
      factory: faker => `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    },
    to_city: {
      order: 7,
      fillable: true,
      factory: faker => faker.location.city(),
    },

    estimated_distance_miles: {
      order: 8,
      fillable: true,
      factory: faker => faker.number.int({ min: 80, max: 1200 }),
    },

    status: {
      order: 9,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: () => 'planned',
    },
  },
} as const)
