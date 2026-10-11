/**
 * Users feature: request → Msg → dispatch. All impure inputs (hash, lookup, id, time)
 * are computed here and placed in the Msg.
 *
 * @TODO: LDAP — replace `loadCredentials` + `verifyPassword` in POST /sign-in with an LDAP bind,
 * upsert the user row from the directory entry, and drop /sign-up.
 */
import { Hono } from 'hono'

import { dispatch, type Feature } from '../../shared/dispatch.js'
import { takeFlash } from '../../shared/flash.js'
import { hashPassword, verifyPassword } from '../../shared/password.js'
import { clearSessionCookie, currentUserId, isHx, setSessionCookie, type AppEnv } from '../../shared/session.js'
import { currentTheme } from '../../shared/theme.js'
import { init, normalizeUsername, update, type Effect, type Loaded, type Model, type Msg } from './core.js'
import { usersStore } from './store.js'
import { SignInForm, SignInPage, SignUpForm, SignUpPage } from './view.js'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export const usersFeature: Feature<Loaded, Model, Msg, Effect> = {
  name: 'users',
  load: () => ({}),
  init,
  update,
  runEffects: usersStore.runEffects,
  shellEffects: (c, effects) => {
    for (const e of effects) {
      if (e.type === 'SetSession') {
        setSessionCookie(c, e.user.id)
        if (isHx(c)) c.header('HX-Redirect', '/')
      } else if (e.type === 'ClearSession') {
        clearSessionCookie(c)
        if (isHx(c)) c.header('HX-Redirect', '/sign-in')
      }
    }
  },
  render: (c, model) => (c.req.path === '/sign-up' ? <SignUpForm model={model} /> : <SignInForm model={model} />),
  redirectTo: (c, model) => (model.notice?.kind === 'success' ? (c.req.path === '/sign-out' ? '/sign-in' : '/') : c.req.path),
}

export const users = new Hono<AppEnv>()

const redirectIfSignedIn = (c: Parameters<typeof currentUserId>[0]) =>
  currentUserId(c) && usersStore.loadUserById(currentUserId(c)!) ? c.redirect('/', 303) : null

users.get('/sign-in', (c) => redirectIfSignedIn(c) ?? c.html(<SignInPage model={init({})} theme={currentTheme(c)} notice={takeFlash(c)} />))

users.get('/sign-up', (c) => redirectIfSignedIn(c) ?? c.html(<SignUpPage model={init({})} theme={currentTheme(c)} notice={takeFlash(c)} />))

users.post('/sign-up', async (c) => {
  const body = await c.req.parseBody()
  const username = str(body.username)
  const password = str(body.password)
  return dispatch(c, usersFeature, {
    type: 'SignUp',
    username,
    displayName: str(body.displayName),
    password,
    confirm: str(body.confirm),
    usernameTaken: usersStore.loadCredentials(normalizeUsername(username)) !== null,
    id: crypto.randomUUID(),
    passwordHash: hashPassword(password),
    now: new Date().toISOString(),
  })
})

users.post('/sign-in', async (c) => {
  const body = await c.req.parseBody()
  const username = str(body.username)
  const creds = usersStore.loadCredentials(normalizeUsername(username))
  return dispatch(c, usersFeature, {
    type: 'SignIn',
    username,
    user: creds?.user ?? null,
    passwordMatches: creds ? verifyPassword(str(body.password), creds.passwordHash) : false,
  })
})

users.post('/sign-out', (c) => dispatch(c, usersFeature, { type: 'SignOut' }))
