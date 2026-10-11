/** Todos feature: the only SQL for the todo table. Rows never leave this file. */
import { db, prepared, type Db } from '../../shared/db.js'
import type { Effect, Todo } from './core.js'

type Row = { id: string; description: string; completed: number; created_at: string; updated_at: string }

const toTodo = (r: Row): Todo => ({
  id: r.id,
  description: r.description,
  completed: r.completed === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export const makeStore = (conn: Db) => {
  const q = {
    byUser: prepared(
      conn,
      'SELECT id, description, completed, created_at, updated_at FROM todo WHERE user_id = ? ORDER BY created_at, id',
    ),
    insert: prepared(
      conn,
      'INSERT INTO todo (id, user_id, description, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    update: prepared(conn, 'UPDATE todo SET description = ?, completed = ?, updated_at = ? WHERE id = ?'),
    remove: prepared(conn, 'DELETE FROM todo WHERE id = ?'),
  }

  const loadTodos = (userId: string): Todo[] => (q.byUser.all(userId) as Row[]).map(toTodo)

  /** Persistence effects only; `Publish` belongs to the shell. Call inside transaction(). */
  const runEffects = (effects: Effect[]): void => {
    for (const e of effects) {
      switch (e.type) {
        case 'InsertTodo':
          q.insert.run(e.todo.id, e.userId, e.todo.description, e.todo.completed ? 1 : 0, e.todo.createdAt, e.todo.updatedAt)
          break
        case 'UpdateTodo':
          q.update.run(e.todo.description, e.todo.completed ? 1 : 0, e.todo.updatedAt, e.todo.id)
          break
        case 'DeleteTodo':
          q.remove.run(e.id)
          break
        case 'Publish':
          break
      }
    }
  }

  return { loadTodos, runEffects }
}

export const todosStore = makeStore(db)
