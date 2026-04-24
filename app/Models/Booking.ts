import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Booking',
  table: 'bookings',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'bookings_car_dates_index',
      columns: ['car_id', 'start_date', 'end_date'],
    },
    {
      name: 'bookings_user_status_index',
      columns: ['user_id', 'status'],
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 30,
    },
    useApi: {
      uri: 'bookings',
      routes: ['index', 'store', 'show', 'update'],
    },
    useSearch: {
      displayable: ['id', 'reference', 'status', 'startDate', 'endDate', 'total'],
      searchable: ['reference', 'driverFirstName', 'driverLastName', 'driverEmail'],
      sortable: ['startDate', 'endDate', 'total', 'created_at'],
      filterable: ['status', 'car_id', 'user_id', 'protectionPlan'],
    },
    observe: true,
  },

  belongsTo: ['Car', 'User'],
  belongsToMany: ['Extra'],
  hasMany: ['Review'],

  attributes: {
    reference: {
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(20),
      },
      factory: faker => `DRV-${faker.string.numeric(6)}`,
    },

    car_id: {
      order: 101,
      fillable: true,
      factory: () => null,
    },

    user_id: {
      order: 102,
      fillable: true,
      factory: () => null,
    },

    status: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['pending', 'confirmed', 'active', 'completed', 'cancelled']),
    },

    startDate: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.date.soon({ days: 60 }).toISOString().slice(0, 10),
    },

    endDate: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.date.soon({ days: 90, refDate: faker.date.soon({ days: 61 }) }).toISOString().slice(0, 10),
    },

    pickupTime: {
      order: 5,
      fillable: true,
      factory: () => '10:00',
    },

    returnTime: {
      order: 6,
      fillable: true,
      factory: () => '10:00',
    },

    pickupLocation: {
      order: 7,
      fillable: true,
      factory: () => 'host',
    },

    deliveryAddress: {
      order: 8,
      fillable: true,
      factory: () => null,
    },

    protectionPlan: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['minimum', 'standard', 'premium']),
    },

    subtotal: {
      order: 10,
      fillable: true,
      factory: faker => faker.number.int({ min: 100, max: 5000 }),
    },

    protectionFee: {
      order: 11,
      fillable: true,
      factory: faker => faker.number.int({ min: 0, max: 500 }),
    },

    extrasFee: {
      order: 12,
      fillable: true,
      factory: () => 0,
    },

    taxes: {
      order: 13,
      fillable: true,
      factory: faker => faker.number.int({ min: 10, max: 400 }),
    },

    total: {
      order: 14,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
      },
      factory: faker => faker.number.int({ min: 120, max: 6000 }),
    },

    platformFee: {
      order: 15,
      fillable: false,
      factory: () => 0,
    },

    payoutAmount: {
      order: 16,
      fillable: false,
      factory: () => 0,
    },

    driverFirstName: {
      order: 17,
      fillable: true,
      factory: faker => faker.person.firstName(),
    },

    driverLastName: {
      order: 18,
      fillable: true,
      factory: faker => faker.person.lastName(),
    },

    driverEmail: {
      order: 19,
      fillable: true,
      validation: {
        rule: schema.string().email(),
      },
      factory: faker => faker.internet.email(),
    },

    driverPhone: {
      order: 20,
      fillable: true,
      factory: faker => faker.phone.number(),
    },

    driverDob: {
      order: 21,
      fillable: true,
      factory: faker => faker.date.birthdate({ min: 21, max: 70, mode: 'age' }).toISOString().slice(0, 10),
    },

    driverLicense: {
      order: 22,
      hidden: true,
      fillable: true,
      factory: faker => faker.string.alphanumeric(10).toUpperCase(),
    },

    driverLicenseState: {
      order: 23,
      fillable: true,
      factory: faker => faker.location.state({ abbreviated: true }),
    },

    paymentMethod: {
      order: 24,
      fillable: true,
      factory: () => 'card',
    },

    paymentIntentId: {
      order: 25,
      fillable: false,
      hidden: true,
      factory: () => null,
    },

    cancellationReason: {
      order: 26,
      fillable: true,
      factory: () => null,
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
