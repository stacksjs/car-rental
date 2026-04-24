import { existsSync } from 'node:fs'
import { parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path } from '@stacksjs/path'
import { cors, route } from '@stacksjs/router'
import { generateAutoImportFiles, injectGlobalAutoImports } from '@stacksjs/server'

const _options = parseOptions()
const port = config.ports?.api || 3008

// Regenerate the model + function auto-import manifest ONLY when the generated
// index is missing — a live file watcher restart will already handle updates
// through initiateImports(). Regenerating on every boot (and thus every
// hot-reload cycle) triggers an infinite loop when a watcher is observing the
// auto-imports directory.
const modelsIndex = path.storagePath('framework/auto-imports/models.ts')
if (!existsSync(modelsIndex))
  await generateAutoImportFiles()

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
