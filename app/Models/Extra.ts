import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Extra',
  table: 'extras',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 5,
    },
    useApi: {
      uri: 'extras',
      routes: ['index', 'show'],
    },
  },

  belongsToMany: ['Booking'],

  attributes: {
    code: {
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(40),
      },
      factory: faker => faker.helpers.arrayElement(['child-seat', 'toll-pass', 'charger', 'prepaid-refuel', 'additional-driver']),
    },

    name: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(80),
      },
      factory: faker => faker.helpers.arrayElement(['Child seat', 'Toll pass', 'Portable charger', 'Prepaid refuel', 'Additional driver']),
    },

    description: {
      order: 3,
      fillable: true,
      factory: faker => faker.lorem.sentence(),
    },

    pricePerDay: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 5, max: 30 }),
    },

    icon: {
      order: 5,
      fillable: true,
      factory: () => null,
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
