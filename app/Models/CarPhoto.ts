import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'CarPhoto',
  table: 'car_photos',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'car-photos',
      routes: ['index', 'store', 'show', 'destroy'],
    },
  },

  belongsTo: ['Car'],

  attributes: {
    url: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(500),
      },
      factory: faker => `https://images.unsplash.com/photo-${faker.number.int({ min: 1500000000000, max: 1700000000000 })}?w=1600`,
    },

    caption: {
      order: 2,
      fillable: true,
      factory: () => null,
    },

    position: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 10 }),
    },

    isPrimary: {
      order: 4,
      fillable: true,
      factory: () => false,
    },
  },
} as const)
