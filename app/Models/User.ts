import type { Attributes } from '@stacksjs/types'
import { defineModel } from '@stacksjs/orm'
import { makeHash } from '@stacksjs/security'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'User',
  table: 'users',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'users_email_name_index',
      columns: ['email', 'name'],
    },
  ],

  traits: {
    useAuth: {
      usePasskey: true,
    },
    useUuid: true,
    useTimestamps: true,
    useSocials: ['github', 'google'],
    useSearch: {
      displayable: ['id', 'name', 'email', 'role'],
      searchable: ['name', 'email'],
      sortable: ['created_at', 'updated_at'],
      filterable: ['role'],
    },
    useSeeder: {
      count: 15,
    },
    useApi: {
      uri: 'users',
      // All user-facing reads go through /api/me (which adds host_profile +
      // is_admin context anyway). The auto-CRUD store/show/index would all
      // leak PII without a per-row authz layer that the user-scoped
      // ownership config below ONLY enforces on writes. /api/auth/register
      // is the proper entry point for creating accounts.
      routes: ['update'],
    },
    billable: true,
    observe: true,
  },

  hasOne: ['HostProfile'],

  // /api/users/{id} is allowed only when the id matches the authed user.
  // Admins bypass for support workflows.
  ownership: {
    field: 'id',
    resolve: async (user: any) => Number(user?._attributes?.id ?? user?.id) || null,
    bypass: (user: any) => (user?._attributes?.role ?? user?.role) === 'admin',
  },

  hasMany: [
    'PersonalAccessToken',
    'Customer',
    'Booking',
    'Review',
  ],

  attributes: {
    name: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().min(2).max(100),
        message: {
          min: 'Name must have a minimum of 2 characters',
          max: 'Name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    email: {
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().email().required(),
        message: {
          required: 'Email is required',
          email: 'Email must be a valid email address',
        },
      },
      factory: faker => faker.internet.email(),
    },

    password: {
      order: 3,
      hidden: true,
      fillable: true,
      validation: {
        rule: schema.string().required().min(6).max(255),
        message: {
          required: 'Password is required',
          min: 'Password must have a minimum of 6 characters',
          max: 'Password must have a maximum of 255 characters',
        },
      },
      factory: () => '123456',
    },

    phone: {
      order: 4,
      fillable: true,
      validation: { rule: schema.string().max(32) },
      factory: faker => faker.phone.number(),
    },

    date_of_birth: {
      order: 5,
      fillable: true,
      factory: faker => faker.date.birthdate({ min: 21, max: 70, mode: 'age' }).toISOString().slice(0, 10),
    },

    license_number: {
      order: 6,
      hidden: true,
      fillable: true,
      validation: { rule: schema.string().max(32) },
      factory: faker => faker.string.alphanumeric(10).toUpperCase(),
    },

    license_state: {
      order: 7,
      fillable: true,
      validation: { rule: schema.string().length(2) },
      factory: faker => faker.location.state({ abbreviated: true }),
    },

    avatar_url: {
      order: 8,
      fillable: true,
      factory: faker => faker.image.avatar(),
    },

    role: {
      order: 9,
      fillable: true,
      validation: { rule: schema.string().required() },
      factory: faker => faker.helpers.arrayElement(['guest', 'guest', 'guest', 'host', 'host', 'admin']),
    },
  },

  get: {
    salutationName: (attributes: Attributes) => attributes.name,
    initials: (attributes: Attributes) => {
      const parts = String(attributes.name || '').split(' ').filter(Boolean)
      return (parts[0]?.[0] ?? '').concat(parts[1]?.[0] ?? '').toUpperCase()
    },
  },

  set: {
    password: async (attributes: Attributes) => {
      return await makeHash(attributes.password, { algorithm: 'bcrypt' })
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
