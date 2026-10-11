/** Tracer and a span wrapper used by the shell. The core never imports this. */
import { SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api'

import { config } from './config.js'

export const tracer = trace.getTracer(config.serviceName)

/**
 * Runs `fn` inside an active span. Works for sync and async functions:
 * exceptions are recorded, the status set to ERROR, and the span always ended.
 */
export const withSpan = <T>(name: string, fn: (span: Span) => T, attributes?: Attributes): T =>
  tracer.startActiveSpan(name, { attributes }, (span) => {
    const fail = (err: unknown) => {
      span.recordException(err instanceof Error ? err : new Error(String(err)))
      span.setStatus({ code: SpanStatusCode.ERROR })
    }
    try {
      const result = fn(span)
      if (result instanceof Promise) {
        return result.then(
          (v) => {
            span.end()
            return v
          },
          (err) => {
            fail(err)
            span.end()
            throw err
          },
        ) as T
      }
      span.end()
      return result
    } catch (err) {
      fail(err)
      span.end()
      throw err
    }
  })
