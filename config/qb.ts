import process from 'node:process'

export default {
  verbose: false,
  dialect: (process.env.DB_CONNECTION as 'sqlite' | 'postgres' | 'mysql') || 'sqlite',
  database: {
    database: process.env.DB_CONNECTION === 'sqlite'
      ? `database/${(process.env.DB_DATABASE || 'stacks').replace(/['"]/g, '')}.sqlite`
      : (process.env.DB_DATABASE || 'stacks'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
  },
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultOrderColumn: 'created_at',
  },
  pagination: {
    defaultPerPage: 25,
    cursorColumn: 'id',
  },
  relations: {
    foreignKeyFormat: 'singularParent_id',
    maxDepth: 10,
    maxEagerLoad: 50,
    detectCycles: true,
  },
}
