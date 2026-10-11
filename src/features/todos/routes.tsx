/** Todos feature: request → Msg → dispatch. IDs and timestamps are minted here. */
import { Hono, type MiddlewareHandler } from 'hono'
import { streamSSE } from 'hono/streaming'

import { publish, subscribe } from '../../shared/bus.js'
import { dispatch, type Ctx, type Feature } from '../../shared/dispatch.js'
import { takeFlash } from '../../shared/flash.js'
import { parseQuery } from '../../shared/query.js'
import { isHx, type AppEnv } from '../../shared/session.js'
import { withSpan } from '../../shared/telemetry.js'
import { currentTheme } from '../../shared/theme.js'
import { withQuery } from '../../shared/types.js'
import { init, splitDescriptions, update, type Effect, type Loaded, type Model, type Msg } from './core.js'
import { todosStore } from './store.js'
import { AddForm, EditRow, Page, StaleNotice, TodoList, TodoRow } from './view.js'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []
const now = () => new Date().toISOString()

export const todosFeature: Feature<Loaded, Model, Msg, Effect> = {
  name: 'todos',
  load: (c) => ({ user: c.var.user, todos: todosStore.loadTodos(c.var.user.id) }),
  init,
  update,
  runEffects: todosStore.runEffects,
  shellEffects: (_c, effects) => {
    for (const e of effects) if (e.type === 'Publish') publish(e.userId, e.event)
  },
  render: (c, model) => {
    // After a dispatch the browser always returns to normal mode.
    const query = { ...parseQuery(c), mode: 'normal' as const }
    const addForm = c.req.path === '/todos' ? <AddForm draft={model.draft} query={query} oob /> : null
    return (
      <>
        <TodoList model={model} query={query} />
        {addForm}
      </>
    )
  },
  redirectTo: (c) => withQuery('/', { ...parseQuery(c), mode: 'normal' }),
}

/** `auth` is the requireUser middleware; injected so this feature never imports the users store. */
export const todos = (auth: MiddlewareHandler<AppEnv>) => {
  const r = new Hono<AppEnv>()

  const loadModel = (c: Ctx) => init(todosFeature.load(c))

  r.get('/', auth, (c) => {
    const query = parseQuery(c)
    const model = loadModel(c)
    if (isHx(c)) return c.html(<TodoList model={model} query={query} />)
    return c.html(<Page model={model} query={query} theme={currentTheme(c)} notice={takeFlash(c)} />)
  })

  r.post('/todos', auth, async (c) => {
    const raw = str((await c.req.parseBody()).todo)
    return dispatch(c, todosFeature, {
      type: 'AddTodos',
      raw,
      ids: splitDescriptions(raw).map(() => crypto.randomUUID()),
      now: now(),
    })
  })

  r.post('/todos/:id/toggle', auth, (c) =>
    dispatch(c, todosFeature, { type: 'ToggleTodo', id: c.req.param('id'), now: now() }),
  )

  // A single row (used by the edit form's Cancel link).
  r.get('/todos/:id', auth, (c) => {
    const query = parseQuery(c)
    const todo = loadModel(c).todos.find((t) => t.id === c.req.param('id'))
    if (!isHx(c)) return c.redirect(withQuery('/', query), 303)
    return todo ? c.html(<TodoRow todo={todo} query={query} />) : c.notFound()
  })

  r.get('/todos/:id/edit', auth, (c) => {
    const query = parseQuery(c)
    const model = loadModel(c)
    const todo = model.todos.find((t) => t.id === c.req.param('id'))
    if (!todo) return isHx(c) ? c.notFound() : c.redirect(withQuery('/', query), 303)
    if (isHx(c)) return c.html(<EditRow todo={todo} query={query} />)
    return c.html(<Page model={model} query={query} theme={currentTheme(c)} notice={takeFlash(c)} editingId={todo.id} />)
  })

  r.post('/todos/:id/edit', auth, async (c) => {
    const body = await c.req.parseBody()
    return dispatch(c, todosFeature, {
      type: 'EditTodo',
      id: c.req.param('id'),
      description: str(body.description),
      now: now(),
    })
  })

  r.post('/todos/bulk', auth, async (c) => {
    const body = await c.req.parseBody({ all: true })
    return dispatch(c, todosFeature, { type: 'BulkUpdate', toggle: list(body.toggle), remove: list(body.remove), now: now() })
  })

  /**
   * Subscriptions (Elm's `Sub`): one SSE stream per signed-in browser tab.
   * The event carries no payload; the client re-fetches the list for its own filter/sort.
   */
  r.get('/todos/events', auth, (c) => {
    const userId = c.var.user.id
    return streamSSE(c, async (stream) => {
      let seq = 0
      const unsubscribe = subscribe(userId, 'todos-changed', () => {
        void withSpan('sse push todos-changed', () =>
          stream.writeSSE({ event: 'todos-changed', data: 'changed', id: String(++seq) }),
        )
      })
      stream.onAbort(unsubscribe)
      await stream.writeSSE({ event: 'connected', data: 'ok' })
      while (!stream.aborted) {
        await stream.sleep(25_000)
        if (!stream.aborted) await stream.writeSSE({ event: 'ping', data: '' })
      }
    })
  })

  // Shown in bulk mode when the list changed elsewhere (FR-L4), instead of replacing the form.
  r.get('/todos/stale', auth, (c) => c.html(<StaleNotice query={parseQuery(c)} />))

  return r
}
