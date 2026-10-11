/**
 * Types shared between the pure core/view files and the shell.
 * This file must stay free of runtime imports so core.ts and view.tsx may import it.
 */

export type Notice = { kind: 'success' | 'error'; text: string }

export type Filter = 'all' | 'active' | 'completed'
export type Sort = 'created-desc' | 'created-asc' | 'alpha'
export type Mode = 'normal' | 'bulk'

/** Browser-side UI state carried in the URL. Read by `view`, never part of a `Model`. */
export type Query = { filter: Filter; sort: Sort; mode: Mode }

export const defaultQuery: Query = { filter: 'all', sort: 'created-desc', mode: 'normal' }

export type Theme = 'light' | 'dark' | 'system'

export type SessionUser = { id: string; username: string; displayName: string }

/** Builds a relative URL with the query state appended. Pure. */
export const withQuery = (path: string, q: Query): string => {
  const params: string[] = []
  if (q.filter !== defaultQuery.filter) params.push(`filter=${q.filter}`)
  if (q.sort !== defaultQuery.sort) params.push(`sort=${q.sort}`)
  if (q.mode !== defaultQuery.mode) params.push(`mode=${q.mode}`)
  return params.length === 0 ? path : `${path}?${params.join('&')}`
}
