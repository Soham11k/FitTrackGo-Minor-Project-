#!/usr/bin/env node
/**
 * Swaps dynamic API/auth routes with static stubs so `output: export` succeeds.
 * Run before build:android; run restore-after-android-build.mjs after.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/**
 * @param {string[]} parts path segments under app/
 */
function swapRoute(parts) {
  const routeDir = path.join(root, 'app', ...parts)
  const routePath = path.join(routeDir, 'route.ts')
  const staticPath = path.join(routeDir, 'route.static.ts')
  const backupPath = path.join(routeDir, 'route.ts.backup')

  if (!fs.existsSync(staticPath)) {
    console.error(`Missing ${path.relative(root, staticPath)}`)
    process.exit(1)
  }
  if (fs.existsSync(backupPath)) {
    console.warn(`Skip ${parts.join('/')}: backup already exists.`)
    return
  }
  fs.copyFileSync(routePath, backupPath)
  fs.copyFileSync(staticPath, routePath)
  console.log(`Swapped app/${parts.join('/')}/route.ts → static stub.`)
}

const ROUTES_TO_STUB = [
  ['auth', 'callback'],
  ['api', 'health'],
  ['api', 'report-error'],
  ['api', 'delete-account'],
  ['api', 'wearables', 'sync'],
  ['api', 'wearables', 'disconnect'],
  ['api', 'wearables', 'history'],
  ['api', 'wearables', 'live'],
  ['api', 'wearables', 'status'],
  ['api', 'wearables', 'fitbit', 'authorize'],
  ['api', 'wearables', 'fitbit', 'callback'],
]

for (const parts of ROUTES_TO_STUB) {
  swapRoute(parts)
}
console.log('Android static-export prep done. Run node scripts/restore-after-android-build.mjs after building.')
