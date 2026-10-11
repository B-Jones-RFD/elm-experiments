/**
 * Todos feature: pure core (Model, Msg, Effect, init, update) plus the pure
 * filter/sort helpers the view uses. Imports nothing but types.
 */
import type { Notice, Query, SessionUser } from '../../shared/types.js'

export type Todo = {
  id: string
  description: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export type Model = {
  user: SessionUser
  todos: Todo[]
  notice: Notice | null
  /** Raw text of a rejected AddTodos, echoed back into the input. */
  draft: string
}

export type Loaded = { user: SessionUser; todos: Todo[] }

export const init = (l: Loaded): Model => ({ ...l, notice: null, draft: '' })

export type Msg =
  | { type: 'AddTodos'; raw: string; ids: string[]; now: string }
  | { type: 'ToggleTodo'; id: string; now: string }
  | { type: 'EditTodo'; id: string; description: string; now: string }
  | { type: 'BulkUpdate'; toggle: string[]; remove: string[]; now: string }

export type Effect =
  | { type: 'InsertTodo'; todo: Todo; userId: string }
  | { type: 'UpdateTodo'; todo: Todo }
  | { type: 'DeleteTodo'; id: string }
  | { type: 'Publish'; userId: string; event: 'todos-changed' }

export const DESCRIPTION = { min: 4, max: 100 } as const

export const splitDescriptions = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

export const validateDescription = (s: string): string | null => {
  if (s.length < DESCRIPTION.min) return `"${s}" is too short (min ${DESCRIPTION.min} characters)`
  if (s.length > DESCRIPTION.max)
    return `"${s.slice(0, 20)}…" is too long (max ${DESCRIPTION.max} characters)`
  return null
}

export const update = (m: Model, msg: Msg): [Model, Effect[]] => {
  switch (msg.type) {
    case 'AddTodos': {
      const parts = splitDescriptions(msg.raw)
      if (parts.length === 0) return [fail(m, 'Enter at least one todo', msg.raw), []]
      const firstError = parts.map(validateDescription).find((e) => e !== null)
      if (firstError) return [fail(m, firstError, msg.raw), []]
      if (msg.ids.length < parts.length) return [fail(m, 'Could not create todos', msg.raw), []]
      const todos: Todo[] = parts.map((description, i) => ({
        id: msg.ids[i]!,
        description,
        completed: false,
        createdAt: msg.now,
        updatedAt: msg.now,
      }))
      const inserts: Effect[] = todos.map((todo) => ({ type: 'InsertTodo', todo, userId: m.user.id }))
      return [
        ok({ ...m, todos: [...m.todos, ...todos] }, `${todos.length} ${plural(todos.length, 'todo')} created`),
        [...inserts, publish(m)],
      ]
    }

    case 'ToggleTodo': {
      const t = m.todos.find((t) => t.id === msg.id)
      if (!t) return [fail(m, 'Todo not found'), []]
      const next: Todo = { ...t, completed: !t.completed, updatedAt: msg.now }
      return [
        ok(replace(m, next), next.completed ? 'Completed' : 'Reopened'),
        [{ type: 'UpdateTodo', todo: next }, publish(m)],
      ]
    }

    case 'EditTodo': {
      const t = m.todos.find((t) => t.id === msg.id)
      if (!t) return [fail(m, 'Todo not found'), []]
      const description = msg.description.trim()
      const err = validateDescription(description)
      if (err) return [fail(m, err), []]
      if (description === t.description) return [{ ...m, notice: null }, []]
      const next: Todo = { ...t, description, updatedAt: msg.now }
      return [ok(replace(m, next), 'Todo updated'), [{ type: 'UpdateTodo', todo: next }, publish(m)]]
    }

    case 'BulkUpdate': {
      const known = new Set(m.todos.map((t) => t.id))
      const unknown = [...msg.toggle, ...msg.remove].find((id) => !known.has(id))
      if (unknown) return [fail(m, 'Some todos no longer exist; the list has been refreshed'), []]
      const removeSet = new Set(msg.remove)
      const toggleSet = new Set(msg.toggle.filter((id) => !removeSet.has(id)))
      if (removeSet.size + toggleSet.size === 0) return [fail(m, 'Nothing selected'), []]
      const todos = m.todos
        .filter((t) => !removeSet.has(t.id))
        .map((t) => (toggleSet.has(t.id) ? { ...t, completed: !t.completed, updatedAt: msg.now } : t))
      const updates: Effect[] = todos
        .filter((t) => toggleSet.has(t.id))
        .map((todo) => ({ type: 'UpdateTodo', todo }))
      const deletes: Effect[] = [...removeSet].map((id) => ({ type: 'DeleteTodo', id }))
      return [
        ok({ ...m, todos }, `${toggleSet.size} toggled, ${removeSet.size} deleted`),
        [...updates, ...deletes, publish(m)],
      ]
    }
  }
}

// ---- pure view helpers -------------------------------------------------------

export const visibleTodos = (todos: Todo[], q: Query): Todo[] => {
  const filtered =
    q.filter === 'active'
      ? todos.filter((t) => !t.completed)
      : q.filter === 'completed'
        ? todos.filter((t) => t.completed)
        : todos
  const sorted = [...filtered]
  switch (q.sort) {
    case 'created-asc':
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      break
    case 'created-desc':
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      break
    case 'alpha':
      sorted.sort((a, b) => a.description.localeCompare(b.description, undefined, { sensitivity: 'base' }))
      break
  }
  return sorted
}

export const activeCount = (todos: Todo[]): number => todos.filter((t) => !t.completed).length

// ---- private helpers ---------------------------------------------------------

const ok = (m: Model, text: string): Model => ({ ...m, draft: '', notice: { kind: 'success', text } })
const fail = (m: Model, text: string, draft = ''): Model => ({ ...m, draft, notice: { kind: 'error', text } })
const replace = (m: Model, t: Todo): Model => ({ ...m, todos: m.todos.map((x) => (x.id === t.id ? t : x)) })
const publish = (m: Model): Effect => ({ type: 'Publish', userId: m.user.id, event: 'todos-changed' })
const plural = (n: number, w: string) => (n === 1 ? w : `${w}s`)
