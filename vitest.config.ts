import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'hono/jsx' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    env: { DB_PATH: ':memory:', SESSION_SECRET: 'test-secret-not-for-production' },
  },
})
