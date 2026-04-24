import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Coupon',
  table: 'coupons',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'code', 'discount_type', 'discount_value', 'start_date', 'end_date'],
      searchable: ['code', 'description', 'discount_type'],
      sortable: ['created_at', 'start_date', 'end_date', 'discount_value', 'usage_count'],
      filterable: ['discount_type'],
    },
    useSeeder: { count: 15 },
    useApi: { uri: 'coupons' },
    observe: true,
  },

  hasMany: ['Booking'],

  attributes: {
    code: {
      unique: true,
      order: 1,
      fillable: true,
      validation: { rule: schema.string().required().max(50) },
      factory: faker => faker.string.alphanumeric(8).toUpperCase(),
    },

    description: {
      order: 2,
      fillable: true,
      validation: { rule: schema.string() },
      factory: faker => faker.commerce.productDescription(),
    },

    status: {
      order: 3,
      fillable: true,
      validation: { rule: schema.enum(['Active', 'Scheduled', 'Expired']) },
      factory: faker => faker.helpers.arrayElement(['Active', 'Scheduled', 'Expired']),
    },

    is_active: {
      order: 4,
      fillable: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },

    discount_type: {
      order: 5,
      fillable: true,
      validation: { rule: schema.enum(['fixed_amount', 'percentage']).required() },
      factory: faker => faker.helpers.arrayElement(['fixed_amount', 'percentage']),
    },

    discount_value: {
      order: 6,
      fillable: true,
      validation: { rule: schema.number().required().min(0.01) },
      factory: faker => faker.number.int({ min: 5, max: 50 }),
    },

    min_order_amount: {
      order: 7,
      fillable: true,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 50 }),
    },

    max_discount_amount: {
      order: 8,
      fillable: true,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 5, max: 100 }),
    },

    usage_limit: {
      order: 10,
      fillable: true,
      validation: { rule: schema.number().min(1) },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },

    usage_count: {
      order: 11,
      fillable: true,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 50 }),
    },

    start_date: {
      order: 12,
      fillable: true,
      factory: faker => faker.date.recent().toISOString().slice(0, 10),
    },

    end_date: {
      order: 13,
      fillable: true,
      factory: faker => faker.date.future().toISOString().slice(0, 10),
    },
  },

  dashboard: { highlight: true },
} as const)
