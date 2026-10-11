/** Theme preference cookie. Read by the layout, written by POST /theme. */
import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

import type { Theme } from './types.js'

export const THEME_COOKIE = 'theme'
const themes: readonly Theme[] = ['light', 'dark', 'system']

export const parseTheme = (v: unknown): Theme =>
  typeof v === 'string' && (themes as readonly string[]).includes(v) ? (v as Theme) : 'system'

export const currentTheme = (c: Context): Theme => parseTheme(getCookie(c, THEME_COOKIE))

export const setThemeCookie = (c: Context, theme: Theme): void =>
  setCookie(c, THEME_COOKIE, theme, { path: '/', sameSite: 'Lax', maxAge: 365 * 24 * 3600 })
