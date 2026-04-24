import { parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { cors, route } from '@stacksjs/router'
import { injectGlobalAutoImports } from '@stacksjs/server'

const _options = parseOptions()
const port = config.ports?.api || 3008

// Inject models (Car, Booking, User, …) + functions onto globalThis so user
// actions can use them without explicit imports, matching framework defaults.
await injectGlobalAutoImports()

// Enable CORS middleware
route.use(cors().handle.bind(cors()))

// Import routes
await route.importRoutes()

// Start server (URL shown by unified dev output)
await route.serve({
  port,
  hostname: '127.0.0.1',
})
