#!/usr/bin/env node
/**
 * Restores the real auth/callback route after Android build.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const routeDir = path.join(root, 'app', 'auth', 'callback')
const routePath = path.join(routeDir, 'route.ts')
const backupPath = path.join(routeDir, 'route.ts.backup')

if (!fs.existsSync(backupPath)) {
  console.warn('No backup found; nothing to restore.')
  process.exit(0)
}

fs.copyFileSync(backupPath, routePath)
fs.unlinkSync(backupPath)
console.log('Restored auth/callback route.')
