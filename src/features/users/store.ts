/** Users feature: the only SQL for the user table. Rows never leave this file. */
import { db, prepared, type Db } from '../../shared/db.js'
import type { SessionUser } from '../../shared/types.js'
import type { Effect } from './core.js'

type Row = { id: string; username: string; display_name: string; password_hash: string }

const toUser = (r: Row): SessionUser => ({ id: r.id, username: r.username, displayName: r.display_name })

export const makeStore = (conn: Db) => {
  const q = {
    byId: prepared(conn, 'SELECT id, username, display_name, password_hash FROM user WHERE id = ?'),
    byUsername: prepared(conn, 'SELECT id, username, display_name, password_hash FROM user WHERE username = ?'),
    insert: prepared(
      conn,
      'INSERT INTO user (id, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ),
  }

  const loadUserById = (id: string): SessionUser | null => {
    const row = q.byId.get(id) as Row | undefined
    return row ? toUser(row) : null
  }

  const loadCredentials = (username: string): { user: SessionUser; passwordHash: string } | null => {
    const row = q.byUsername.get(username) as Row | undefined
    return row ? { user: toUser(row), passwordHash: row.password_hash } : null
  }

  /** Persistence effects only; session effects belong to the shell. Call inside transaction(). */
  const runEffects = (effects: Effect[]): void => {
    for (const e of effects) {
      switch (e.type) {
        case 'InsertUser':
          q.insert.run(e.user.id, e.user.username, e.user.displayName, e.passwordHash, e.createdAt)
          break
        case 'SetSession':
        case 'ClearSession':
          break
      }
    }
  }

  return { loadUserById, loadCredentials, runEffects }
}

export const usersStore = makeStore(db)
