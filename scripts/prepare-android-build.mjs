#!/usr/bin/env node
/**
 * Swaps auth/callback route with a static stub so static export succeeds.
 * Run before build:android; run restore-after-android-build.mjs after.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const routeDir = path.join(root, 'app', 'auth', 'callback')
const routePath = path.join(routeDir, 'route.ts')
const staticPath = path.join(routeDir, 'route.static.ts')
const backupPath = path.join(routeDir, 'route.ts.backup')

if (!fs.existsSync(staticPath)) {
  console.error('Missing app/auth/callback/route.static.ts')
  process.exit(1)
}

if (fs.existsSync(backupPath)) {
  console.warn('Backup already exists; skipping prepare. Run restore-after-android-build.mjs first.')
  process.exit(0)
}

fs.copyFileSync(routePath, backupPath)
fs.copyFileSync(staticPath, routePath)
console.log('Swapped auth/callback to static stub for Android build.')
console.log('Run node scripts/restore-after-android-build.mjs after building.')
