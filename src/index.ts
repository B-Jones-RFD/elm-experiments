import { serve } from '@hono/node-server'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from './app.js'
import { config } from './shared/config.js'
import { migrate } from './shared/db.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const applied = migrate(resolve(root, 'migrations'))
if (applied.length > 0) console.log(`migrations applied: ${applied.join(', ')}`)

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`elm-todo listening on http://localhost:${info.port}`)
})
