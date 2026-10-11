/** Users feature: pure views. Imports only types from core and shared UI. */
import { Layout } from '../../shared/layout.js'
import type { Notice, Theme } from '../../shared/types.js'
import type { Model } from './core.js'

type PageProps = { model: Model; theme: Theme; notice?: Notice | null }

const Field = (p: { label: string; name: string; type?: string; value?: string; autocomplete?: string; required?: boolean; minlength?: number; maxlength?: number }) => (
  <label class="field">
    <span>{p.label}</span>
    <input
      name={p.name}
      type={p.type ?? 'text'}
      value={p.value ?? ''}
      autocomplete={p.autocomplete}
      required={p.required ?? true}
      minlength={p.minlength}
      maxlength={p.maxlength}
    />
  </label>
)

export const SignInForm = ({ model }: { model: Model }) => (
  <form id="auth-form" class="auth-form" method="post" action="/sign-in" hx-post="/sign-in" hx-swap="outerHTML">
    <h2>Sign in</h2>
    <Field label="Username" name="username" value={model.form.username} autocomplete="username" />
    <Field label="Password" name="password" type="password" autocomplete="current-password" />
    <button type="submit" class="primary">
      Sign in
    </button>
    <p class="muted">
      No account? <a href="/sign-up">Sign up</a>
    </p>
  </form>
)

export const SignUpForm = ({ model }: { model: Model }) => (
  <form id="auth-form" class="auth-form" method="post" action="/sign-up" hx-post="/sign-up" hx-swap="outerHTML">
    <h2>Create an account</h2>
    <Field label="Username" name="username" value={model.form.username} autocomplete="username" minlength={3} maxlength={32} />
    <Field label="Display name" name="displayName" value={model.form.displayName} autocomplete="name" maxlength={60} />
    <Field label="Password" name="password" type="password" autocomplete="new-password" minlength={8} maxlength={128} />
    <Field label="Confirm password" name="confirm" type="password" autocomplete="new-password" minlength={8} maxlength={128} />
    <button type="submit" class="primary">
      Sign up
    </button>
    <p class="muted">
      Have an account? <a href="/sign-in">Sign in</a>
    </p>
  </form>
)

export const SignInPage = ({ model, theme, notice }: PageProps) => (
  <Layout title="Sign in · Elm Todo" theme={theme} notice={notice}>
    <SignInForm model={model} />
  </Layout>
)

export const SignUpPage = ({ model, theme, notice }: PageProps) => (
  <Layout title="Sign up · Elm Todo" theme={theme} notice={notice}>
    <SignUpForm model={model} />
  </Layout>
)
