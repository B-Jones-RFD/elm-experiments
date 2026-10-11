/**
 * Session tokens and the `requireUser` middleware.
 * Token = base64url(`${userId}.${expiresAtMs}`) + '.' + base64url(HMAC-SHA256(secret, payload)).
 *
 * @TODO: LDAP — this module stays as-is. Replace `features/users/routes.tsx` sign-in with an
 * LDAP bind, upsert the user row on first successful bind, then call `setSessionCookie` as now.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { config } from './config.js'
import type { Query, SessionUser } from './types.js'

export const SESSION_COOKIE = 'session'

export type AppEnv = { Variables: { user: SessionUser; query: Query } }

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')
const sign = (payload: string) => b64(createHmac('sha256', config.sessionSecret).update(payload).digest())

export const signSession = (userId: string, now: number): string => {
  const payload = b64(`${userId}.${now + config.sessionTtlHours * 3_600_000}`)
  return `${payload}.${sign(payload)}`
}

/** Returns the user id when the token is well-formed, correctly signed, and unexpired. */
export const verifySession = (token: string, now: number): string | null => {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(sig)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  const decoded = Buffer.from(payload, 'base64url').toString('utf8')
  const dot = decoded.lastIndexOf('.')
  if (dot < 1) return null
  const userId = decoded.slice(0, dot)
  const expiresAt = Number(decoded.slice(dot + 1))
  return Number.isFinite(expiresAt) && expiresAt > now ? userId : null
}

export const setSessionCookie = (c: Context, userId: string): void =>
  setCookie(c, SESSION_COOKIE, signSession(userId, Date.now()), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.isProd,
    path: '/',
    maxAge: config.sessionTtlHours * 3600,
  })

export const clearSessionCookie = (c: Context): void => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export const currentUserId = (c: Context): string | null => {
  const token = getCookie(c, SESSION_COOKIE)
  return token ? verifySession(token, Date.now()) : null
}

export const isHx = (c: Context): boolean => c.req.header('HX-Request') === 'true'

/**
 * Middleware factory: loads the user via `lookup` and sets `c.var.user`, or redirects to sign-in.
 * htmx requests get 401 + HX-Redirect so the browser performs a full navigation.
 */
export const requireUser =
  (lookup: (id: string) => SessionUser | null): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const id = currentUserId(c)
    const user = id ? lookup(id) : null
    if (!user) {
      clearSessionCookie(c)
      if (isHx(c)) {
        c.header('HX-Redirect', '/sign-in')
        return c.body(null, 401)
      }
      return c.redirect('/sign-in', 303)
    }
    c.set('user', user)
    await next()
  }
