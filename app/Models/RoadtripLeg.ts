import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * RoadtripLeg = one segment of a Roadtrip, backed by a Relocation.
 *
 * Sequence ordering is per-roadtrip (0-based). The from_X / to_X / pricing
 * fields are snapshotted off the underlying Relocation at add-time (see
 * _helpers.ts:snapshotLegFromRelocation) so the trip view + the deal
 * the driver agreed to stay stable even if the host edits the
 * relocation row later. status mirrors the leg's relocation lifecycle:
 *   - planned     :: leg added, no application yet
 *   - applied     :: driver has applied to the underlying relocation
 *   - approved    :: host accepted the driver for this relocation
 *   - rejected    :: host rejected the driver, or another driver was picked
 *   - in_progress :: driver started the relocation trip
 *   - completed   :: relocation completed
 *   - cancelled   :: leg removed by user, relocation cancelled by host,
 *                    or trip cancelled by user
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
    flat_fee: 'integer',
    per_mile_rate: 'float',
    fuel_allowance: 'integer',
    max_extra_days: 'integer',
    estimated_pay: 'integer',
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

    // Snapshot of the underlying relocation's pickup/dropoff window. Stored
    // here so the trip view stays stable + the planner can verify timing
    // without joining against the live relocation row.
    earliest_pickup_date: { order: 9, fillable: true, factory: () => null },
    latest_dropoff_date: { order: 10, fillable: true, factory: () => null },

    // Snapshot of the relocation's pricing terms at add-time. Recorded
    // verbatim so a host edit (e.g. lowering flat_fee) can't quietly change
    // the deal an active driver already committed to. See _helpers.ts:
    // snapshotLegFromRelocation.
    compensation_type: { order: 11, fillable: true, factory: () => null },
    flat_fee: { order: 12, fillable: true, factory: () => 0 },
    per_mile_rate: { order: 13, fillable: true, factory: () => 0 },
    fuel_allowance: { order: 14, fillable: true, factory: () => 0 },
    max_extra_days: { order: 15, fillable: true, factory: () => 0 },
    estimated_pay: { order: 16, fillable: true, factory: () => 0 },

    status: {
      order: 17,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: () => 'planned',
    },
  },
} as const)
