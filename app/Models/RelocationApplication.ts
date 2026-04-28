import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * RelocationApplication = a driver's bid on an open Relocation posting.
 *
 * Multiple drivers can apply; the host approves one (which auto-rejects
 * the rest in the action). Tracking applications as their own row gives
 * the host an audit trail and the driver a place to see "you were
 * considered but rejected" without overloading the Relocation row.
 */
export default defineModel({
  name: 'RelocationApplication',
  table: 'relocation_applications',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'relocation_applications_unique',
      columns: ['relocation_id', 'user_id'],
    },
    {
      name: 'relocation_applications_user_status_index',
      columns: ['user_id', 'status'],
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'relocation-applications',
      // Reads only — applications are created via POST /api/relocations/{id}/apply
      // (see ApplyAction) so we can run validation against the parent Relocation.
      routes: ['index', 'show'],
    },
    observe: true,
  },

  belongsTo: ['Relocation', 'User'],

  casts: {
    relocation_id: 'integer',
    user_id: 'integer',
  },

  attributes: {
    relocation_id: { order: 1, fillable: true, factory: () => null },
    user_id: { order: 2, fillable: true, factory: () => null },

    status: {
      order: 3,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: () => 'pending',
    },

    message: {
      order: 4,
      fillable: true,
      validation: { rule: schema.string().max(1000) },
      factory: faker => faker.lorem.sentence(),
    },

    approved_at: { order: 5, fillable: false, factory: () => null },
    rejected_at: { order: 6, fillable: false, factory: () => null },
  },
} as const)
