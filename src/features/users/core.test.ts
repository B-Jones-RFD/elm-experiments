import { describe, expect, it } from 'vitest'

import { init, update, type Msg } from './core.js'

const base = init({})

const signUp = (over: Partial<Extract<Msg, { type: 'SignUp' }>> = {}): Msg => ({
  type: 'SignUp',
  username: 'Chris_H',
  displayName: '  Chris  ',
  password: 'correct horse',
  confirm: 'correct horse',
  usernameTaken: false,
  id: 'u1',
  passwordHash: 'salt:hash',
  now: '2026-10-11T00:00:00.000Z',
  ...over,
})

describe('users/update SignUp', () => {
  it('creates the user and starts a session on valid input', () => {
    const [m, effects] = update(base, signUp())
    const user = { id: 'u1', username: 'chris_h', displayName: 'Chris' }
    expect(m.notice).toEqual({ kind: 'success', text: 'Welcome, Chris' })
    expect(effects).toEqual([
      { type: 'InsertUser', user, passwordHash: 'salt:hash', createdAt: '2026-10-11T00:00:00.000Z' },
      { type: 'SetSession', user },
    ])
  })

  it.each([
    [{ username: 'ab' }, 'Username must be 3–32 characters'],
    [{ username: 'a'.repeat(33) }, 'Username must be 3–32 characters'],
    [{ username: 'bad name!' }, 'Username may contain only letters, numbers, underscores and hyphens'],
    [{ displayName: '   ' }, 'Display name must be 1–60 characters'],
    [{ password: 'short', confirm: 'short' }, 'Password must be 8–128 characters'],
    [{ confirm: 'different' }, 'Passwords do not match'],
    [{ usernameTaken: true }, 'That username is taken'],
  ])('rejects %j with "%s"', (over, text) => {
    const [m, effects] = update(base, signUp(over))
    expect(m.notice).toEqual({ kind: 'error', text })
    expect(effects).toEqual([])
  })

  it('echoes the username and trimmed display name back on rejection', () => {
    const [m] = update(base, signUp({ confirm: 'nope' }))
    expect(m.form).toEqual({ username: 'Chris_H', displayName: 'Chris' })
  })
})

describe('users/update SignIn', () => {
  const user = { id: 'u1', username: 'chris', displayName: 'Chris' }

  it('starts a session when the user exists and the password matches', () => {
    const [m, effects] = update(base, { type: 'SignIn', username: 'chris', user, passwordMatches: true })
    expect(m.notice?.kind).toBe('success')
    expect(effects).toEqual([{ type: 'SetSession', user }])
  })

  it.each([
    ['unknown user', { user: null, passwordMatches: false }],
    ['wrong password', { user, passwordMatches: false }],
  ])('gives the same message for %s', (_label, over) => {
    const [m, effects] = update(base, { type: 'SignIn', username: 'chris', ...over })
    expect(m.notice).toEqual({ kind: 'error', text: 'Incorrect username or password' })
    expect(effects).toEqual([])
  })
})

describe('users/update SignOut', () => {
  it('clears the session', () => {
    const [, effects] = update(base, { type: 'SignOut' })
    expect(effects).toEqual([{ type: 'ClearSession' }])
  })
})
