import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { migrate, openDb, transaction, type Db } from '../../shared/db.js'
import { makeStore as makeUsersStore } from '../users/store.js'
import type { Todo } from './core.js'
import { makeStore } from './store.js'

const todo = (id: string, description: string, completed = false): Todo => ({
  id,
  description,
  completed,
  createdAt: `2026-10-11T00:00:0${id.length}.000Z`,
  updatedAt: '2026-10-11T00:00:00.000Z',
})

describe('todos/store', () => {
  let conn: Db
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    conn = openDb(':memory:')
    migrate(resolve(import.meta.dirname, '../../../migrations'), conn)
    store = makeStore(conn)
    const users = makeUsersStore(conn)
    transaction(() => {
      for (const id of ['u1', 'u2'])
        users.runEffects([{ type: 'InsertUser', user: { id, username: id, displayName: id }, passwordHash: 'h', createdAt: 't' }])
    }, conn)
  })

  it('round-trips insert, update, delete and maps completed to a boolean', () => {
    const a = todo('a', 'Alpha')
    const b = todo('bb', 'Bravo', true)
    transaction(
      () =>
        store.runEffects([
          { type: 'InsertTodo', todo: a, userId: 'u1' },
          { type: 'InsertTodo', todo: b, userId: 'u1' },
          { type: 'Publish', userId: 'u1', event: 'todos-changed' },
        ]),
      conn,
    )
    expect(store.loadTodos('u1')).toEqual([a, b])

    const a2 = { ...a, description: 'Alpha two', completed: true, updatedAt: 'T2' }
    transaction(() => store.runEffects([{ type: 'UpdateTodo', todo: a2 }, { type: 'DeleteTodo', id: 'bb' }]), conn)
    expect(store.loadTodos('u1')).toEqual([a2])
  })

  it('scopes loadTodos to one user', () => {
    transaction(
      () =>
        store.runEffects([
          { type: 'InsertTodo', todo: todo('a', 'Mine'), userId: 'u1' },
          { type: 'InsertTodo', todo: todo('b', 'Theirs'), userId: 'u2' },
        ]),
      conn,
    )
    expect(store.loadTodos('u1').map((t) => t.description)).toEqual(['Mine'])
    expect(store.loadTodos('u2').map((t) => t.description)).toEqual(['Theirs'])
  })

  it('enforces the description length check at the database too', () => {
    expect(() =>
      transaction(() => store.runEffects([{ type: 'InsertTodo', todo: todo('a', 'abc'), userId: 'u1' }]), conn),
    ).toThrow(/CHECK/)
  })

  it('rolls back a failed batch entirely', () => {
    expect(() =>
      transaction(
        () =>
          store.runEffects([
            { type: 'InsertTodo', todo: todo('a', 'Alpha'), userId: 'u1' },
            { type: 'InsertTodo', todo: todo('b', 'Bravo'), userId: 'ghost' },
          ]),
        conn,
      ),
    ).toThrow(/FOREIGN KEY/)
    expect(store.loadTodos('u1')).toEqual([])
  })
})
