// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/** Modules the pure core and views may never touch (architecture notes §5–6). */
const impureModules = [
  { name: 'hono', message: 'core/view must not import Hono' },
  { group: ['hono/*', '@hono/*'], message: 'core/view must not import Hono' },
  { group: ['node:*'], message: 'core/view must not import Node built-ins' },
  { group: ['@opentelemetry/*'], message: 'core/view must not import OpenTelemetry' },
  { group: ['**/store', '**/store.js', '**/routes', '**/routes.js'], message: 'core/view must not import the shell' },
]

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'public/', 'data/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/features/**/core.ts', 'src/features/**/view.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: impureModules.filter((m) => 'name' in m), patterns: impureModules.filter((m) => 'group' in m) }],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Timestamps come from the shell inside the Msg' },
        { name: 'crypto', message: 'IDs come from the shell inside the Msg' },
        { name: 'Math', message: 'Randomness comes from the shell inside the Msg' },
        { name: 'process', message: 'Config belongs to the shell' },
        { name: 'console', message: 'Logging belongs to the shell' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
)
