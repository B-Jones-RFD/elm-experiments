/**
 * The Elm runtime for one request:
 *   load → init → update → runEffects (persistence, in one transaction)
 *   → shellEffects (cookies, bus; after commit) → respond.
 * Every mutating route in every feature goes through here, so this is the one
 * place that owns transactions and tracing for state changes.
 */
import type { Context } from 'hono'
import type { HtmlEscapedString } from 'hono/utils/html'

import { transaction } from './db.js'
import { respond } from './respond.js'
import { isHx, type AppEnv } from './session.js'
import { withSpan } from './telemetry.js'
import type { Notice } from './types.js'

export type Ctx = Context<AppEnv>

type HasNotice = { notice: Notice | null }
type Tagged = { type: string }

export type Feature<L, M extends HasNotice, Msg extends Tagged, E extends Tagged> = {
  name: string
  /** Impure: reads the slice of the database this feature's messages need. */
  load: (c: Ctx) => L
  /** Pure: wraps loaded data into a Model. */
  init: (loaded: L) => M
  /** Pure: the Elm update function. */
  update: (model: M, msg: Msg) => [M, E[]]
  /** Impure: interprets persistence effects. Called inside the transaction. */
  runEffects: (effects: E[]) => void
  /** Impure: interprets non-persistence effects (cookies, bus). Called after commit. */
  shellEffects: (c: Ctx, effects: E[], model: M) => void
  /** Pure: the fragment htmx swaps in after a successful dispatch. */
  render: (c: Ctx, model: M) => HtmlEscapedString | Promise<HtmlEscapedString>
  /** Where a non-JS browser is sent after the dispatch. */
  redirectTo: (c: Ctx, model: M) => string
}

export const dispatch = <L, M extends HasNotice, Msg extends Tagged, E extends Tagged>(
  c: Ctx,
  feature: Feature<L, M, Msg, E>,
  msg: Msg,
): Response | Promise<Response> =>
  withSpan(`dispatch ${msg.type}`, (span) => {
    span.setAttributes({
      'app.feature': feature.name,
      'app.msg': msg.type,
      'http.hx_request': isHx(c),
      'http.hx_target': c.req.header('HX-Target') ?? '',
    })

    const [model, effects] = transaction(() => {
      const loaded = withSpan('loadModel', () => feature.load(c))
      const [next, effects] = feature.update(feature.init(loaded), msg)
      withSpan('runEffects', () => feature.runEffects(effects), { 'app.effect_count': effects.length })
      return [next, effects] as const
    })

    span.setAttribute('app.effects', effects.map((e) => e.type))
    if (model.notice?.kind === 'error') span.setAttribute('app.rejected', true)

    feature.shellEffects(c, effects, model)
    return respond(c, model.notice, () => feature.render(c, model), feature.redirectTo(c, model))
  })
