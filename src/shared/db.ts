/**
 * SQLite connection, transaction helper, and migration runner.
 * `node:sqlite` is synchronous: nothing inside `transaction()` can yield, so a
 * read-update-write cycle cannot interleave with another request in this process.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
// Node 26 names the class `Database`; `DatabaseSync` is the alias that @types/node declares.
import { DatabaseSync } from 'node:sqlite'

import { config } from './config.js'

export type Db = DatabaseSync

export const openDb = (path: string): Db => {
  const db = new DatabaseSync(path, { timeout: 5000 })
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

export const db: Db = openDb(config.dbPath)

/** Runs `fn` inside BEGIN IMMEDIATE … COMMIT, rolling back on throw. */
export const transaction = <T>(fn: () => T, conn: Db = db): T => {
  conn.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    conn.exec('COMMIT')
    return result
  } catch (err) {
    conn.exec('ROLLBACK')
    throw err
  }
}

const userVersion = (conn: Db): number =>
  (conn.prepare('PRAGMA user_version').get() as { user_version: number }).user_version

/** Applies `NNN_name.sql` files above the current PRAGMA user_version, each in its own transaction. */
export const migrate = (dir: string, conn: Db = db): number[] => {
  const current = userVersion(conn)
  const pending = readdirSync(dir)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .map((f) => ({ n: Number(f.slice(0, 3)), sql: readFileSync(join(dir, f), 'utf8') }))
    .filter((m) => m.n > current)
    .sort((a, b) => a.n - b.n)

  for (const m of pending) {
    transaction(() => {
      conn.exec(m.sql)
      conn.exec(`PRAGMA user_version = ${m.n}`)
    }, conn)
  }
  return pending.map((m) => m.n)
}

/**
 * A statement prepared on first use. Lets stores build their statement tables at module
 * load without requiring the schema to exist yet (migrations run after imports).
 */
export type Prepared = {
  get: (...params: SQLInputValue[]) => unknown
  all: (...params: SQLInputValue[]) => unknown[]
  run: (...params: SQLInputValue[]) => void
}

type SQLInputValue = null | number | bigint | string | Uint8Array

export const prepared = (conn: Db, sql: string): Prepared => {
  let stmt: ReturnType<Db['prepare']> | undefined
  const s = () => (stmt ??= conn.prepare(sql))
  return {
    get: (...p) => s().get(...p),
    all: (...p) => s().all(...p),
    run: (...p) => {
      s().run(...p)
    },
  }
}
