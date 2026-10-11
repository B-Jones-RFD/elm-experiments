/**
 * Users feature: pure core (Model, Msg, Effect, init, update).
 * Everything impure — hashing, lookups, IDs, timestamps — is done by the shell
 * and arrives inside the Msg. This file imports nothing but types.
 */
import type { Notice, SessionUser } from '../../shared/types.js'

export type Model = {
  notice: Notice | null
  /** Echoed back so a rejected form keeps what the user typed (never the password). */
  form: { username: string; displayName: string }
}

export type Loaded = Record<never, never>

export const init = (_loaded: Loaded): Model => ({
  notice: null,
  form: { username: '', displayName: '' },
})

export type Msg =
  | {
      type: 'SignUp'
      username: string
      displayName: string
      password: string
      confirm: string
      usernameTaken: boolean
      id: string
      passwordHash: string
      now: string
    }
  | { type: 'SignIn'; username: string; user: SessionUser | null; passwordMatches: boolean }
  | { type: 'SignOut' }

export type Effect =
  | { type: 'InsertUser'; user: SessionUser; passwordHash: string; createdAt: string }
  | { type: 'SetSession'; user: SessionUser }
  | { type: 'ClearSession' }

export const USERNAME = { min: 3, max: 32, pattern: /^[a-z0-9_-]+$/ } as const
export const DISPLAY_NAME = { min: 1, max: 60 } as const
export const PASSWORD = { min: 8, max: 128 } as const

export const normalizeUsername = (s: string): string => s.trim().toLowerCase()

export const validateSignUp = (m: {
  username: string
  displayName: string
  password: string
  confirm: string
  usernameTaken: boolean
}): string | null => {
  const username = normalizeUsername(m.username)
  const displayName = m.displayName.trim()
  if (username.length < USERNAME.min || username.length > USERNAME.max)
    return `Username must be ${USERNAME.min}–${USERNAME.max} characters`
  if (!USERNAME.pattern.test(username))
    return 'Username may contain only letters, numbers, underscores and hyphens'
  if (displayName.length < DISPLAY_NAME.min || displayName.length > DISPLAY_NAME.max)
    return `Display name must be ${DISPLAY_NAME.min}–${DISPLAY_NAME.max} characters`
  if (m.password.length < PASSWORD.min || m.password.length > PASSWORD.max)
    return `Password must be ${PASSWORD.min}–${PASSWORD.max} characters`
  if (m.password !== m.confirm) return 'Passwords do not match'
  if (m.usernameTaken) return 'That username is taken'
  return null
}

export const update = (m: Model, msg: Msg): [Model, Effect[]] => {
  switch (msg.type) {
    case 'SignUp': {
      const form = { username: msg.username, displayName: msg.displayName.trim() }
      const err = validateSignUp(msg)
      if (err) return [{ ...m, form, notice: { kind: 'error', text: err } }, []]
      const user: SessionUser = {
        id: msg.id,
        username: normalizeUsername(msg.username),
        displayName: form.displayName,
      }
      return [
        { ...m, form, notice: { kind: 'success', text: `Welcome, ${user.displayName}` } },
        [
          { type: 'InsertUser', user, passwordHash: msg.passwordHash, createdAt: msg.now },
          { type: 'SetSession', user },
        ],
      ]
    }
    case 'SignIn': {
      const form = { username: msg.username, displayName: '' }
      if (!msg.user || !msg.passwordMatches)
        return [{ ...m, form, notice: { kind: 'error', text: 'Incorrect username or password' } }, []]
      return [
        { ...m, form, notice: { kind: 'success', text: `Welcome back, ${msg.user.displayName}` } },
        [{ type: 'SetSession', user: msg.user }],
      ]
    }
    case 'SignOut':
      return [{ ...m, notice: { kind: 'success', text: 'Signed out' } }, [{ type: 'ClearSession' }]]
  }
}
