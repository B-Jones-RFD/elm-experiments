/** One-shot notice carried across a redirect for the no-JS path. */
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import type { Notice } from './types.js'

const FLASH_COOKIE = 'flash'

export const setFlash = (c: Context, notice: Notice): void =>
  setCookie(c, FLASH_COOKIE, encodeURIComponent(JSON.stringify(notice)), {
    path: '/',
    sameSite: 'Lax',
    httpOnly: true,
    maxAge: 60,
  })

/** Reads and clears the flash notice, if any. */
export const takeFlash = (c: Context): Notice | null => {
  const raw = getCookie(c, FLASH_COOKIE)
  if (!raw) return null
  deleteCookie(c, FLASH_COOKIE, { path: '/' })
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<Notice>
    if ((parsed.kind === 'success' || parsed.kind === 'error') && typeof parsed.text === 'string')
      return { kind: parsed.kind, text: parsed.text }
  } catch {
    /* malformed cookie: ignore */
  }
  return null
}
