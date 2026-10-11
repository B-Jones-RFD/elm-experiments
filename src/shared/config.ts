/** Environment configuration. Fails fast at import time when a required value is missing. */

const env = process.env

const str = (name: string, fallback: string): string => env[name]?.trim() || fallback

const int = (name: string, fallback: number): number => {
  const raw = env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Config: ${name} must be a positive integer, got "${raw}"`)
  return n
}

const required = (name: string): string => {
  const v = env[name]?.trim()
  if (!v) throw new Error(`Config: ${name} is required. See .env.example.`)
  return v
}

const oneOf = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
  const v = env[name]?.trim()
  if (!v) return fallback
  if (!(allowed as readonly string[]).includes(v))
    throw new Error(`Config: ${name} must be one of ${allowed.join(', ')}, got "${v}"`)
  return v as T
}

export const config = {
  port: int('PORT', 3000),
  dbPath: str('DB_PATH', './data/app.db'),
  sessionSecret: required('SESSION_SECRET'),
  sessionTtlHours: int('SESSION_TTL_HOURS', 168),
  serviceName: str('OTEL_SERVICE_NAME', 'elm-todo'),
  tracesExporter: oneOf('OTEL_TRACES_EXPORTER', ['console'] as const, 'console'),
  isProd: env.NODE_ENV === 'production',
} as const

export type Config = typeof config
