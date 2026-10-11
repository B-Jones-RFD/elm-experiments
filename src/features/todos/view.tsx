/**
 * Todos feature: pure views over Model + Query.
 * Every htmx attribute has a plain-HTML twin (action/href) so the page works without JS.
 */
import { Layout } from '../../shared/layout.js'
import { withQuery, type Filter, type Notice, type Query, type Sort, type Theme } from '../../shared/types.js'
import { DESCRIPTION, activeCount, visibleTodos, type Model, type Todo } from './core.js'

const listSwap = { 'hx-target': '#todos', 'hx-swap': 'outerHTML' } as const

// ---- add form ----------------------------------------------------------------

export const AddForm = ({ draft, query, oob = false }: { draft: string; query: Query; oob?: boolean }) => (
  <form
    id="add-form"
    class="add-form"
    method="post"
    action={withQuery('/todos', query)}
    hx-post={withQuery('/todos', query)}
    {...listSwap}
    hx-swap-oob={oob ? 'true' : undefined}
  >
    <input
      name="todo"
      value={draft}
      placeholder="Take out trash, water plants"
      aria-label="New todos, comma separated"
      autocomplete="off"
      required
      autofocus={oob || undefined}
    />
    <button type="submit" class="primary" aria-label="Add">
      +
    </button>
  </form>
)

// ---- list header: filters, sort, count -----------------------------------------

const FilterLink = ({ q, filter, label }: { q: Query; filter: Filter; label: string }) => {
  const href = withQuery('/', { ...q, filter })
  return (
    <a href={href} hx-get={href} hx-push-url="true" {...listSwap} aria-current={q.filter === filter ? 'page' : undefined}>
      {label}
    </a>
  )
}

const SortSelect = ({ q }: { q: Query }) => (
  <form method="get" action="/" class="sort-form" hx-get="/" hx-push-url="true" hx-trigger="change" {...listSwap}>
    {q.filter !== 'all' && <input type="hidden" name="filter" value={q.filter} />}
    {q.mode !== 'normal' && <input type="hidden" name="mode" value={q.mode} />}
    <label>
      <span class="visually-hidden">Sort</span>
      <select name="sort" aria-label="Sort">
        {(
          [
            ['created-desc', 'Newest first'],
            ['created-asc', 'Oldest first'],
            ['alpha', 'A to Z'],
          ] as [Sort, string][]
        ).map(([value, label]) => (
          <option value={value} selected={q.sort === value}>
            {label}
          </option>
        ))}
      </select>
    </label>
    <noscript>
      <button type="submit">Sort</button>
    </noscript>
  </form>
)

const ListHeader = ({ model, query }: { model: Model; query: Query }) => {
  const n = activeCount(model.todos)
  return (
    <div class="list-header">
      <nav class="filters" aria-label="Filter">
        <FilterLink q={query} filter="all" label="All" />
        <FilterLink q={query} filter="active" label="Active" />
        <FilterLink q={query} filter="completed" label="Completed" />
      </nav>
      <span class="count muted">
        {n} {n === 1 ? 'item' : 'items'} left
      </span>
      <SortSelect q={query} />
    </div>
  )
}

const EmptyState = ({ filter }: { filter: Filter }) => (
  <p class="empty muted">
    {filter === 'all'
      ? 'No todos. Create some to get started!'
      : filter === 'active'
        ? 'No active todos.'
        : 'No completed todos.'}
  </p>
)

// ---- rows ----------------------------------------------------------------------

export const TodoRow = ({ todo, query }: { todo: Todo; query: Query }) => {
  const toggle = withQuery(`/todos/${todo.id}/toggle`, query)
  const edit = withQuery(`/todos/${todo.id}/edit`, query)
  return (
    <li id={`todo-${todo.id}`} class={todo.completed ? 'todo done' : 'todo'}>
      <form method="post" action={toggle} hx-post={toggle} {...listSwap} class="toggle-form">
        <input
          type="checkbox"
          name="completed"
          checked={todo.completed}
          onchange="this.form.requestSubmit()"
          aria-label={`Mark "${todo.description}" ${todo.completed ? 'active' : 'completed'}`}
        />
        <button type="submit" class="nojs-only">
          Save
        </button>
      </form>
      <span class="description">{todo.description}</span>
      <a href={edit} hx-get={edit} hx-target={`#todo-${todo.id}`} hx-swap="outerHTML" class="edit-link">
        Edit
      </a>
    </li>
  )
}

export const EditRow = ({ todo, query }: { todo: Todo; query: Query }) => {
  const save = withQuery(`/todos/${todo.id}/edit`, query)
  const cancel = withQuery(`/todos/${todo.id}`, query)
  return (
    <li id={`todo-${todo.id}`} class="todo editing">
      <form method="post" action={save} hx-post={save} {...listSwap} class="edit-form">
        <input
          name="description"
          value={todo.description}
          minlength={DESCRIPTION.min}
          maxlength={DESCRIPTION.max}
          required
          autofocus
          aria-label="Edit description"
        />
        <button type="submit" class="primary">
          Save
        </button>
        <a href={withQuery('/', query)} hx-get={cancel} hx-target={`#todo-${todo.id}`} hx-swap="outerHTML">
          Cancel
        </a>
      </form>
    </li>
  )
}

// ---- bulk mode ------------------------------------------------------------------

const BulkForm = ({ todos, query }: { todos: Todo[]; query: Query }) => {
  const apply = withQuery('/todos/bulk', query)
  return (
    <form method="post" action={apply} hx-post={apply} {...listSwap} class="bulk-form">
      <p class="muted bulk-help">Tick what to toggle or delete, then update all at once.</p>
      <ul class="todo-list">
        {todos.map((t) => (
          <li class={t.completed ? 'todo bulk done' : 'todo bulk'}>
            <label class="bulk-toggle">
              <input type="checkbox" name="toggle" value={t.id} /> <span>toggle</span>
            </label>
            <span class="description">{t.description}</span>
            <label class="bulk-remove">
              <input type="checkbox" name="remove" value={t.id} /> <span>delete</span>
            </label>
          </li>
        ))}
      </ul>
      <div class="bulk-actions">
        <button type="submit" class="primary">
          Update all
        </button>
        <a href={withQuery('/', { ...query, mode: 'normal' })} class="button">
          Cancel
        </a>
      </div>
    </form>
  )
}

// ---- the list ------------------------------------------------------------------

export const TodoList = ({ model, query, editingId }: { model: Model; query: Query; editingId?: string }) => {
  const visible = visibleTodos(model.todos, query)
  const bulkHref = withQuery('/', { ...query, mode: 'bulk' })
  return (
    <section id="todos" class="todos" data-mode={query.mode}>
      <ListHeader model={model} query={query} />
      <div id="stale-notice" />
      {visible.length === 0 ? (
        <EmptyState filter={query.filter} />
      ) : query.mode === 'bulk' ? (
        <BulkForm todos={visible} query={query} />
      ) : (
        <ul class="todo-list">
          {visible.map((t) => (t.id === editingId ? <EditRow todo={t} query={query} /> : <TodoRow todo={t} query={query} />))}
        </ul>
      )}
      {query.mode === 'normal' && visible.length > 0 && (
        <a href={bulkHref} hx-get={bulkHref} hx-push-url="true" {...listSwap} class="button">
          Bulk operations
        </a>
      )}
    </section>
  )
}

export const Page = ({
  model,
  query,
  theme,
  notice,
  editingId,
}: {
  model: Model
  query: Query
  theme: Theme
  notice: Notice | null
  editingId?: string
}) => (
  <Layout title="Elm Todo" theme={theme} user={model.user} notice={notice}>
    <AddForm draft={model.draft} query={query} />
    <TodoList model={model} query={query} editingId={editingId} />
  </Layout>
)
