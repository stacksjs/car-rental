import type { Attributes } from '@stacksjs/types'
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Customer',
  table: 'customers',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'email', 'phone', 'status'],
      searchable: ['name', 'email', 'phone'],
      sortable: ['name', 'total_spent', 'last_booking', 'created_at', 'updated_at'],
      filterable: ['status'],
    },
    useSeeder: { count: 20 },
    useApi: { uri: 'customers' },
    observe: true,
  },

  hasMany: ['Payment'],
  belongsTo: ['User'],

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: { rule: schema.string().required().min(2).max(255) },
      factory: faker => faker.person.fullName(),
    },
    email: {
      unique: true,
      order: 2,
      fillable: true,
      validation: { rule: schema.string().required().email() },
      factory: faker => faker.internet.email(),
    },
    phone: {
      order: 3,
      fillable: true,
      validation: { rule: schema.string().required().min(10).max(50) },
      factory: faker => faker.phone.number({ style: 'international' }),
    },
    total_spent: {
      default: 0,
      order: 5,
      fillable: true,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 2000 }),
    },
    last_booking: {
      order: 6,
      fillable: true,
      factory: faker => faker.date.recent({ days: 60 }).toISOString().split('T')[0],
    },
    status: {
      default: 'Active',
      order: 7,
      fillable: true,
      validation: { rule: schema.enum(['Active', 'Inactive']).required() },
      factory: faker => faker.helpers.arrayElement(['Active', 'Inactive']),
    },
    avatar: {
      order: 8,
      fillable: true,
      validation: { rule: schema.string().url().optional() },
      factory: faker => faker.image.avatar(),
    },
  },

  get: {
    fullContactInfo: (a: Attributes) => `${a.name} (${a.email}, ${a.phone})`,
  },

  dashboard: { highlight: true },
} as const)
