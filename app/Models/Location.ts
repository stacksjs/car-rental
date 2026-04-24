import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Location',
  table: 'locations',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 10,
    },
    useApi: {
      uri: 'locations',
      routes: ['index', 'show'],
    },
    useSearch: {
      displayable: ['id', 'name', 'state', 'country', 'listingCount', 'image'],
      searchable: ['name', 'state', 'country'],
      sortable: ['listingCount', 'name'],
      filterable: ['state', 'country'],
    },
  },

  hasMany: ['Car'],

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().min(2).max(100),
      },
      factory: faker => faker.location.city(),
    },

    state: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().length(2),
      },
      factory: faker => faker.location.state({ abbreviated: true }),
    },

    country: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required().length(2),
      },
      factory: () => 'US',
    },

    lat: {
      order: 4,
      fillable: true,
      factory: faker => faker.location.latitude(),
    },

    lng: {
      order: 5,
      fillable: true,
      factory: faker => faker.location.longitude(),
    },

    listingCount: {
      order: 6,
      fillable: false,
      factory: faker => faker.number.int({ min: 50, max: 5000 }),
    },

    image: {
      order: 7,
      fillable: true,
      factory: faker => `https://images.unsplash.com/photo-${faker.number.int({ min: 1500000000000, max: 1700000000000 })}?w=800`,
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
