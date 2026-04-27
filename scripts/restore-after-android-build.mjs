#!/usr/bin/env node
/**
 * Restores real routes after Android build (reverses prepare-android-build.mjs).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/**
 * @param {string[]} parts path segments under app/
 */
function restoreRoute(parts) {
  const routeDir = path.join(root, 'app', ...parts)
  const routePath = path.join(routeDir, 'route.ts')
  const backupPath = path.join(routeDir, 'route.ts.backup')

  if (!fs.existsSync(backupPath)) {
    return
  }
  fs.copyFileSync(backupPath, routePath)
  fs.unlinkSync(backupPath)
  console.log(`Restored app/${parts.join('/')}/route.ts`)
}

const ROUTES_TO_RESTORE = [
  ['auth', 'callback'],
  ['api', 'ai-coach', 'chat'],
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
  ['api', 'wearables', '[provider]', 'auth'],
  ['api', 'wearables', '[provider]', 'callback'],
  ['api', 'wearables', '[provider]', 'disconnect'],
  ['api', 'cron', 'reminders'],
]

for (const parts of ROUTES_TO_RESTORE) {
  restoreRoute(parts)
}
console.log('Restore complete.')
