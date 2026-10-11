// Copies browser assets from node_modules into public/ so the app serves them itself.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assets = [
  ['node_modules/htmx.org/dist/htmx.min.js', 'public/htmx.min.js'],
  ['node_modules/htmx-ext-sse/dist/sse.min.js', 'public/sse.min.js'],
]

mkdirSync(resolve(root, 'public'), { recursive: true })
for (const [from, to] of assets) {
  const src = resolve(root, from)
  if (!existsSync(src)) {
    console.warn(`vendor: ${from} not found (run install first)`)
    continue
  }
  copyFileSync(src, resolve(root, to))
  console.log(`vendor: ${from} -> ${to}`)
}
