/** Parses the UI state carried in the URL into a `Query`. */
import type { Context } from 'hono'

import { defaultQuery, type Filter, type Mode, type Query, type Sort } from './types.js'

const pick = <T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T =>
  v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

export const parseQuery = (c: Context): Query => ({
  filter: pick<Filter>(c.req.query('filter'), ['all', 'active', 'completed'], defaultQuery.filter),
  sort: pick<Sort>(c.req.query('sort'), ['created-desc', 'created-asc', 'alpha'], defaultQuery.sort),
  mode: pick<Mode>(c.req.query('mode'), ['normal', 'bulk'], defaultQuery.mode),
})
