/** Creates the Hono app: middleware, static assets, feature mounts, error handling. */
import { serveStatic } from '@hono/node-server/serve-static'
import { httpInstrumentationMiddleware } from '@hono/otel'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { Hono } from 'hono'

import { todos } from './features/todos/routes.js'
import { users } from './features/users/routes.js'
import { usersStore } from './features/users/store.js'
import { config } from './shared/config.js'
import { setFlash } from './shared/flash.js'
import { Layout, Toast } from './shared/layout.js'
import { isHx, requireUser, type AppEnv } from './shared/session.js'
import { currentTheme, parseTheme, setThemeCookie } from './shared/theme.js'

export const app = new Hono<AppEnv>()

app.use('*', httpInstrumentationMiddleware({ serviceName: config.serviceName, captureRequestHeaders: ['hx-request', 'hx-target'] }))
app.use('/*', serveStatic({ root: './public' }))

app.route('/', users)
app.route('/', todos(requireUser(usersStore.loadUserById)))

app.post('/theme', async (c) => {
  const body = await c.req.parseBody()
  setThemeCookie(c, parseTheme(body.theme))
  if (isHx(c)) {
    c.header('HX-Refresh', 'true')
    return c.body(null, 204)
  }
  return c.redirect(c.req.header('Referer') ?? '/', 303)
})

app.notFound((c) =>
  c.html(
    <Layout title="Not found · Elm Todo" theme={currentTheme(c)}>
      <h2>Page not found</h2>
      <p>
        <a href="/">Back to your todos</a>
      </p>
    </Layout>,
    404,
  ),
)

const GENERIC = { kind: 'error', text: 'Something went wrong. Please try again.' } as const

app.onError((err, c) => {
  const span = trace.getActiveSpan()
  span?.recordException(err)
  span?.setStatus({ code: SpanStatusCode.ERROR })
  if (!config.isProd) console.error(err)
  if (isHx(c)) return c.html(<Toast notice={GENERIC} oob />, 500)
  if (c.req.method === 'GET') {
    return c.html(
      <Layout title="Error · Elm Todo" theme={currentTheme(c)} notice={GENERIC}>
        <h2>Something went wrong</h2>
        <p>
          <a href="/">Back to your todos</a>
        </p>
      </Layout>,
      500,
    )
  }
  setFlash(c, GENERIC)
  return c.redirect('/', 303)
})
