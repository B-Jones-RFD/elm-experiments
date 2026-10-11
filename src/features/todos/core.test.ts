import { describe, expect, it } from 'vitest'

import { activeCount, init, update, visibleTodos, type Model, type Todo } from './core.js'

const user = { id: 'u1', username: 'chris', displayName: 'Chris' }
const NOW = '2026-10-11T12:00:00.000Z'
const todo = (id: string, description: string, completed = false, createdAt = NOW): Todo => ({
  id,
  description,
  completed,
  createdAt,
  updatedAt: createdAt,
})

const model = (...todos: Todo[]): Model => init({ user, todos })
const publish = { type: 'Publish', userId: 'u1', event: 'todos-changed' } as const

describe('todos/update AddTodos', () => {
  it('creates one todo per comma-separated segment, trimmed, empties dropped', () => {
    const [m, effects] = update(model(), {
      type: 'AddTodos',
      raw: '  Buy milk , , Walk the dog,',
      ids: ['a', 'b', 'c'],
      now: NOW,
    })
    const a = todo('a', 'Buy milk')
    const b = todo('b', 'Walk the dog')
    expect(m.todos).toEqual([a, b])
    expect(m.notice).toEqual({ kind: 'success', text: '2 todos created' })
    expect(m.draft).toBe('')
    expect(effects).toEqual([
      { type: 'InsertTodo', todo: a, userId: 'u1' },
      { type: 'InsertTodo', todo: b, userId: 'u1' },
      publish,
    ])
  })

  it('uses the singular for one todo', () => {
    const [m] = update(model(), { type: 'AddTodos', raw: 'Read', ids: ['a'], now: NOW })
    expect(m.notice?.text).toBe('1 todo created')
  })

  it('rejects the whole batch when any segment is too short and keeps the draft', () => {
    const raw = 'Buy milk, abc'
    const [m, effects] = update(model(), { type: 'AddTodos', raw, ids: ['a', 'b'], now: NOW })
    expect(m.todos).toEqual([])
    expect(m.draft).toBe(raw)
    expect(m.notice).toEqual({ kind: 'error', text: '"abc" is too short (min 4 characters)' })
    expect(effects).toEqual([])
  })

  it('rejects a segment over 100 characters', () => {
    const long = 'x'.repeat(101)
    const [m, effects] = update(model(), { type: 'AddTodos', raw: long, ids: ['a'], now: NOW })
    expect(m.notice?.text).toMatch(/too long \(max 100 characters\)/)
    expect(effects).toEqual([])
  })

  it('rejects empty input', () => {
    const [m, effects] = update(model(), { type: 'AddTodos', raw: ' , ,', ids: [], now: NOW })
    expect(m.notice).toEqual({ kind: 'error', text: 'Enter at least one todo' })
    expect(effects).toEqual([])
  })
})

describe('todos/update ToggleTodo', () => {
  it('flips completed and stamps updatedAt', () => {
    const [m, effects] = update(model(todo('a', 'Buy milk')), { type: 'ToggleTodo', id: 'a', now: 'T2' })
    const next = { ...todo('a', 'Buy milk'), completed: true, updatedAt: 'T2' }
    expect(m.todos).toEqual([next])
    expect(m.notice).toEqual({ kind: 'success', text: 'Completed' })
    expect(effects).toEqual([{ type: 'UpdateTodo', todo: next }, publish])
  })

  it('reopens a completed todo', () => {
    const [m] = update(model(todo('a', 'Buy milk', true)), { type: 'ToggleTodo', id: 'a', now: 'T2' })
    expect(m.todos[0]?.completed).toBe(false)
    expect(m.notice?.text).toBe('Reopened')
  })

  it('rejects an unknown id (covers other users’ todos, since load is per user)', () => {
    const [m, effects] = update(model(todo('a', 'Buy milk')), { type: 'ToggleTodo', id: 'zzz', now: NOW })
    expect(m.notice).toEqual({ kind: 'error', text: 'Todo not found' })
    expect(effects).toEqual([])
  })
})

describe('todos/update EditTodo', () => {
  it('updates the trimmed description', () => {
    const [m, effects] = update(model(todo('a', 'Buy milk')), {
      type: 'EditTodo',
      id: 'a',
      description: '  Buy oat milk ',
      now: 'T2',
    })
    const next = { ...todo('a', 'Buy oat milk'), updatedAt: 'T2' }
    expect(m.todos).toEqual([next])
    expect(effects).toEqual([{ type: 'UpdateTodo', todo: next }, publish])
  })

  it('is a no-op without effects when the description is unchanged', () => {
    const [m, effects] = update(model(todo('a', 'Buy milk')), {
      type: 'EditTodo',
      id: 'a',
      description: 'Buy milk',
      now: 'T2',
    })
    expect(m.notice).toBeNull()
    expect(effects).toEqual([])
  })

  it('rejects an invalid description', () => {
    const [m, effects] = update(model(todo('a', 'Buy milk')), { type: 'EditTodo', id: 'a', description: 'ab', now: NOW })
    expect(m.notice?.kind).toBe('error')
    expect(effects).toEqual([])
  })

  it('rejects an unknown id', () => {
    const [m] = update(model(), { type: 'EditTodo', id: 'a', description: 'Buy milk', now: NOW })
    expect(m.notice).toEqual({ kind: 'error', text: 'Todo not found' })
  })
})

describe('todos/update BulkUpdate', () => {
  const three = model(todo('a', 'Alpha'), todo('b', 'Bravo', true), todo('c', 'Charlie'))

  it('toggles and deletes atomically, delete winning over toggle', () => {
    const [m, effects] = update(three, { type: 'BulkUpdate', toggle: ['a', 'b', 'c'], remove: ['c'], now: 'T2' })
    const a = { ...todo('a', 'Alpha'), completed: true, updatedAt: 'T2' }
    const b = { ...todo('b', 'Bravo', true), completed: false, updatedAt: 'T2' }
    expect(m.todos).toEqual([a, b])
    expect(m.notice).toEqual({ kind: 'success', text: '2 toggled, 1 deleted' })
    expect(effects).toEqual([
      { type: 'UpdateTodo', todo: a },
      { type: 'UpdateTodo', todo: b },
      { type: 'DeleteTodo', id: 'c' },
      publish,
    ])
  })

  it('rejects the whole batch when any id is unknown', () => {
    const [m, effects] = update(three, { type: 'BulkUpdate', toggle: ['a'], remove: ['nope'], now: NOW })
    expect(m.todos).toEqual(three.todos)
    expect(m.notice?.kind).toBe('error')
    expect(effects).toEqual([])
  })

  it('rejects an empty selection', () => {
    const [m, effects] = update(three, { type: 'BulkUpdate', toggle: [], remove: [], now: NOW })
    expect(m.notice).toEqual({ kind: 'error', text: 'Nothing selected' })
    expect(effects).toEqual([])
  })
})

describe('todos/visibleTodos', () => {
  const todos = [todo('a', 'bravo', false, 'T1'), todo('b', 'Alpha', true, 'T2'), todo('c', 'charlie', false, 'T3')]

  it('filters', () => {
    expect(visibleTodos(todos, { filter: 'active', sort: 'created-asc', mode: 'normal' }).map((t) => t.id)).toEqual(['a', 'c'])
    expect(visibleTodos(todos, { filter: 'completed', sort: 'created-asc', mode: 'normal' }).map((t) => t.id)).toEqual(['b'])
  })

  it('sorts newest first by default, oldest first, and alphabetically ignoring case', () => {
    expect(visibleTodos(todos, { filter: 'all', sort: 'created-desc', mode: 'normal' }).map((t) => t.id)).toEqual(['c', 'b', 'a'])
    expect(visibleTodos(todos, { filter: 'all', sort: 'created-asc', mode: 'normal' }).map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(visibleTodos(todos, { filter: 'all', sort: 'alpha', mode: 'normal' }).map((t) => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('does not mutate its input', () => {
    const copy = [...todos]
    visibleTodos(todos, { filter: 'all', sort: 'alpha', mode: 'normal' })
    expect(todos).toEqual(copy)
  })

  it('counts active todos', () => {
    expect(activeCount(todos)).toBe(2)
  })
})
