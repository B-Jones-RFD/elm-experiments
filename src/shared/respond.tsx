/**
 * Progressive-enhancement response helper.
 * htmx request → the fragment plus an out-of-band toast.
 * Plain request → flash the notice and redirect (303) to the page that shows the result.
 */
import type { Context } from 'hono'
import type { HtmlEscapedString } from 'hono/utils/html'

import { setFlash } from './flash.js'
import { Toast } from './layout.js'
import { isHx } from './session.js'
import type { Notice } from './types.js'

type Fragment = HtmlEscapedString | Promise<HtmlEscapedString>

export const respond = (
  c: Context,
  notice: Notice | null,
  fragment: () => Fragment,
  redirectTo: string,
): Response | Promise<Response> => {
  if (isHx(c)) {
    return c.html(
      <>
        {fragment()}
        <Toast notice={notice} oob />
      </>,
    )
  }
  if (notice) setFlash(c, notice)
  return c.redirect(redirectTo, 303)
}
