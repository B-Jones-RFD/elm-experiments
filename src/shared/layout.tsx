/** Page shell and the toast component. Shell-side UI shared by every feature. */
import type { Child } from 'hono/jsx'

import type { Notice, SessionUser, Theme } from './types.js'

export const Toast = ({ notice, oob = false }: { notice: Notice | null; oob?: boolean }) => {
  if (!notice) return oob ? null : <div id="toasts" class="toasts" />
  const toast = (
    <output class={`toast toast-${notice.kind}`} role="status">
      <span>{notice.text}</span>
      <button type="button" class="toast-close" aria-label="Dismiss" onclick="this.closest('.toast').remove()">
        ×
      </button>
    </output>
  )
  return oob ? (
    <div id="toasts" class="toasts" hx-swap-oob="beforeend">
      {toast}
    </div>
  ) : (
    <div id="toasts" class="toasts">
      {toast}
    </div>
  )
}

const ThemeToggle = ({ theme }: { theme: Theme }) => (
  <form method="post" action="/theme" class="theme-toggle" hx-post="/theme" hx-swap="none">
    {(['light', 'dark', 'system'] as const).map((t) => (
      <button type="submit" name="theme" value={t} aria-pressed={theme === t} title={`${t} theme`}>
        {t === 'light' ? '☀' : t === 'dark' ? '☾' : '◐'}
      </button>
    ))}
  </form>
)

const UserMenu = ({ user }: { user: SessionUser }) => (
  <form method="post" action="/sign-out" class="user-menu">
    <span class="avatar" aria-hidden="true">
      {user.displayName.slice(0, 1).toUpperCase()}
    </span>
    <span class="user-name">{user.displayName}</span>
    <button type="submit" class="link">
      Sign out
    </button>
  </form>
)

export type LayoutProps = {
  title: string
  theme: Theme
  user?: SessionUser | null
  notice?: Notice | null
  children?: Child
}

export const Layout = ({ title, theme, user, notice = null, children }: LayoutProps) => (
  <html lang="en" data-theme={theme}>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <link rel="stylesheet" href="/app.css" />
      <script src="/htmx.min.js" defer></script>
      <script src="/sse.min.js" defer></script>
      <script src="/app.js" defer></script>
    </head>
    <body>
      <main class="card">
        <header class="card-header">
          <h1>
            <span aria-hidden="true">✔</span> Elm Todo
          </h1>
          <ThemeToggle theme={theme} />
          {user ? <UserMenu user={user} /> : null}
        </header>
        {children}
      </main>
      <Toast notice={notice} />
    </body>
  </html>
)
