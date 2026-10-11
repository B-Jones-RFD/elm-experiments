/**
 * OpenTelemetry bootstrap. Loaded before the app via `--import` so the SDK
 * registers its global tracer provider before any module calls `trace.getTracer`.
 */
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'

import { config } from './shared/config.js'

const sdk = new NodeSDK({
  serviceName: config.serviceName,
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
})

sdk.start()

const shutdown = () => {
  sdk.shutdown().finally(() => process.exit(0))
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
