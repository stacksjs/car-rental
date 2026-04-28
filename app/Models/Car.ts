import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Car',
  table: 'cars',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'cars_category_location_index',
      columns: ['category', 'location_id'],
    },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 20 },
    useApi: {
      uri: 'cars',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
    useSearch: {
      displayable: ['id', 'slug', 'make', 'model', 'year', 'trim', 'daily_rate', 'rating', 'review_count', 'category', 'image', 'transmission', 'fuel_type', 'seats', 'instant_book', 'delivery_available'],
      searchable: ['make', 'model', 'trim', 'description'],
      sortable: ['daily_rate', 'rating', 'review_count', 'trips', 'created_at'],
      filterable: ['category', 'transmission', 'fuel_type', 'seats', 'instant_book', 'delivery_available', 'status', 'location_id', 'host_profile_id'],
    },
    observe: true,
    taggable: true,
    likeable: true,
  },

  belongsTo: ['HostProfile', 'Location'],
  hasMany: ['CarPhoto', 'Booking', 'Review'],

  casts: {
    instant_book: 'boolean',
    delivery_available: 'boolean',
    daily_rate: 'integer',
    seats: 'integer',
    doors: 'integer',
    rating: 'float',
    review_count: 'integer',
    trips: 'integer',
    year: 'integer',
  },

  // Auto-CRUD ownership stamp: when a host hits POST /api/cars without an
  // explicit `host_profile_id`, look up their HostProfile by user_id and
  // attach it.
  authedFill: {
    creating: {
      host_profile_id: async (user: any) => {
        const userId = Number(user?._attributes?.id ?? user?.id)
        if (!userId) return null
        const hp = await HostProfile.query().where('user_id', userId).first() as any
        return hp ? Number(hp._attributes?.id ?? hp.id) : null
      },
    },
  },

  // Auto-CRUD ownership enforcement: PATCH /api/cars/{id} + DELETE only
  // succeed when `cars.host_profile_id` matches the authed user's host
  // profile. Without this, any authed user could re-parent or delete
  // someone else's listing.
  ownership: {
    field: 'host_profile_id',
    resolve: async (user: any) => {
      const userId = Number(user?._attributes?.id ?? user?.id)
      if (!userId) return null
      const hp = await HostProfile.query().where('user_id', userId).first() as any
      return hp ? Number(hp._attributes?.id ?? hp.id) : null
    },
    bypass: (user: any) => (user?._attributes?.role ?? user?.role) === 'admin',
  },

  attributes: {
    slug: {
      unique: true,
      order: 1,
      fillable: true,
      validation: { rule: schema.string().required().max(120) },
      factory: faker => `${faker.vehicle.manufacturer()}-${faker.vehicle.model()}-${faker.number.int({ min: 2015, max: 2025 })}`.toLowerCase().replace(/\s+/g, '-'),
    },

    make: {
      order: 2,
      fillable: true,
      validation: { rule: schema.string().required().max(60) },
      factory: faker => faker.helpers.arrayElement(['Tesla', 'Porsche', 'BMW', 'Mercedes', 'Toyota', 'Honda', 'Ford', 'Jeep', 'Rivian', 'Land Rover', 'Mazda']),
    },

    model: {
      order: 3,
      fillable: true,
      validation: { rule: schema.string().required().max(60) },
      factory: faker => faker.vehicle.model(),
    },

    year: {
      order: 4,
      fillable: true,
      validation: { rule: schema.number().min(1950).max(2030) },
      factory: faker => faker.number.int({ min: 2015, max: 2025 }),
    },

    trim: {
      order: 5,
      fillable: true,
      factory: faker => faker.helpers.arrayElement(['Long Range', 'Carrera S', 'M Sport', 'Sport', 'Premium', null]),
    },

    daily_rate: {
      order: 6,
      fillable: true,
      validation: { rule: schema.number().required().min(0) },
      factory: faker => faker.number.int({ min: 45, max: 450 }),
    },

    original_price: { order: 7, fillable: true, factory: () => null },

    seats: { order: 8, fillable: true, factory: faker => faker.helpers.arrayElement([2, 4, 5, 7]) },
    doors: { order: 9, fillable: true, factory: faker => faker.helpers.arrayElement([2, 4]) },

    transmission: {
      order: 10,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.helpers.arrayElement(['Automatic', 'Manual']),
    },

    fuel_type: {
      order: 11,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.helpers.arrayElement(['Gasoline', 'Electric', 'Hybrid', 'Diesel']),
    },

    mpg: { order: 12, fillable: true, factory: () => '28 city / 34 hwy' },
    range: { order: 13, fillable: true, factory: () => null },

    category: {
      order: 14,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.helpers.arrayElement(['EV', 'SUV', 'Luxury', 'Convertible', 'Truck', 'Sports', 'Classic', 'Compact', 'Minivan']),
    },

    description: { order: 15, fillable: true, factory: faker => faker.lorem.sentences(2) },
    image: { order: 16, fillable: true, factory: faker => `https://images.unsplash.com/photo-${faker.number.int({ min: 1500000000000, max: 1700000000000 })}?w=1200` },

    license_plate: {
      unique: true,
      order: 17,
      fillable: false,
      hidden: true,
      factory: faker => faker.string.alphanumeric(7).toUpperCase(),
    },

    vin: {
      unique: true,
      order: 18,
      fillable: false,
      hidden: true,
      factory: faker => faker.vehicle.vin(),
    },

    instant_book: { order: 19, fillable: true, factory: faker => faker.datatype.boolean({ probability: 0.65 }) },
    delivery_available: { order: 20, fillable: true, factory: faker => faker.datatype.boolean({ probability: 0.4 }) },

    status: {
      order: 21,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: () => 'active',
    },

    rating: { order: 22, fillable: false, factory: faker => faker.number.float({ min: 4.2, max: 5, fractionDigits: 2 }) },
    review_count: { order: 23, fillable: false, factory: faker => faker.number.int({ min: 0, max: 250 }) },
    trips: { order: 24, fillable: false, factory: faker => faker.number.int({ min: 0, max: 500 }) },
    badges: { order: 25, fillable: true, factory: () => null },

    host_profile_id: { order: 100, fillable: true, factory: () => null },
    location_id: { order: 101, fillable: true, factory: () => null },
  },

  dashboard: { highlight: true },
} as const)
