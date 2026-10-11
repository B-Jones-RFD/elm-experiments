import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { migrate, openDb, transaction, type Db } from '../../shared/db.js'
import { makeStore } from './store.js'

describe('users/store', () => {
  let conn: Db
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    conn = openDb(':memory:')
    migrate(resolve(import.meta.dirname, '../../../migrations'), conn)
    store = makeStore(conn)
  })

  it('round-trips InsertUser through loadUserById and loadCredentials', () => {
    const user = { id: 'u1', username: 'chris', displayName: 'Chris' }
    transaction(
      () =>
        store.runEffects([
          { type: 'InsertUser', user, passwordHash: 'salt:hash', createdAt: '2026-10-11T00:00:00.000Z' },
          { type: 'SetSession', user },
        ]),
      conn,
    )
    expect(store.loadUserById('u1')).toEqual(user)
    expect(store.loadCredentials('chris')).toEqual({ user, passwordHash: 'salt:hash' })
    expect(store.loadCredentials('nobody')).toBeNull()
  })

  it('treats usernames case-insensitively for uniqueness', () => {
    const insert = (id: string, username: string) =>
      store.runEffects([
        { type: 'InsertUser', user: { id, username, displayName: 'X' }, passwordHash: 'h', createdAt: 't' },
      ])
    transaction(() => insert('u1', 'chris'), conn)
    expect(() => transaction(() => insert('u2', 'CHRIS'), conn)).toThrow(/UNIQUE/)
  })
})
