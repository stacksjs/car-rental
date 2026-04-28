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
    useSeeder: { count: 60 },
    useApi: {
      uri: 'car-photos',
      // No `store` here — POST /api/cars/{id}/photos is the proper upload
      // endpoint (validates size + MIME). Index + show are public so the
      // car detail SPA can render galleries; destroy is host-only via
      // ownership-by-car below.
      routes: ['index', 'show', 'destroy'],
    },
    observe: true,
  },

  dashboard: { highlight: false },

  belongsTo: ['Car'],

  // Two-hop ownership: CarPhoto.car_id ∈ {cars owned by the authed host's
  // profile}. The framework's `ownsRow` helper accepts an array as the
  // resolved owner value and treats it as set membership.
  ownership: {
    field: 'car_id',
    resolve: async (user: any) => {
      const userId = Number(user?._attributes?.id ?? user?.id)
      if (!userId) return null
      const hp = await HostProfile.query().where('user_id', userId).first() as any
      const hpId = hp ? Number(hp._attributes?.id ?? hp.id) : null
      if (!hpId) return null
      const cars = await Car.query().where('host_profile_id', hpId).select('id').get() as any[]
      // Return the set of allowed car_ids; auto-CRUD checks membership.
      return cars.map(c => Number(c._attributes?.id ?? c.id))
    },
    bypass: (user: any) => (user?._attributes?.role ?? user?.role) === 'admin',
  },

  casts: {
    is_primary: 'boolean',
    position: 'integer',
  },

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

    is_primary: {
      order: 4,
      fillable: true,
      factory: () => false,
    },
  },
} as const)
