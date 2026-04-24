import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Review',
  table: 'reviews',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 50 },
    useApi: {
      uri: 'reviews',
      routes: ['index', 'store', 'show'],
    },
    useSearch: {
      displayable: ['id', 'rating', 'body', 'car_id', 'booking_id', 'user_id'],
      searchable: ['body'],
      sortable: ['rating', 'created_at'],
      filterable: ['car_id', 'rating'],
    },
    observe: true,
  },

  belongsTo: ['Car', 'Booking', 'User'],

  attributes: {
    car_id: { order: 0, fillable: true, factory: () => null },
    booking_id: { order: 1, fillable: true, factory: () => null },
    user_id: { order: 2, fillable: true, factory: () => null },

    rating: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1).max(5),
        message: {
          min: 'Rating must be at least 1',
          max: 'Rating cannot be more than 5',
        },
      },
      factory: faker => faker.number.int({ min: 3, max: 5 }),
    },

    body: {
      order: 4,
      fillable: true,
      validation: { rule: schema.string().required().min(10).max(2000) },
      factory: faker => faker.lorem.paragraph({ min: 2, max: 4 }),
    },

    response: { order: 5, fillable: true, factory: () => null },
  },

  dashboard: { highlight: true },
} as const)
