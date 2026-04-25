#!/usr/bin/env node
/**
 * Bundle-size guard.
 *
 * Reads .next/build-manifest.json and .next/app-build-manifest.json, sums
 * each route's JS payload, and fails the build if any route's first-load
 * JS grows > BUDGET_BYTES or > MAX_GROWTH_PCT over the previous snapshot
 * stored in .cache/bundle-sizes.json.
 *
 * This is a deliberately lightweight alternative to the next/bundle-analyzer
 * so it works in CI without extra dependencies.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const NEXT_DIR = join(ROOT, '.next')
const CACHE_DIR = join(ROOT, '.cache')
const CACHE_FILE = join(CACHE_DIR, 'bundle-sizes.json')
const BUDGET_BYTES = 300 * 1024 // 300 KB per route first-load JS
const MAX_GROWTH_PCT = 10

if (!existsSync(NEXT_DIR)) {
  console.error('Bundle guard: .next not found. Run `npm run build` first.')
  process.exit(1)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const buildManifest = readJson(join(NEXT_DIR, 'build-manifest.json')) ?? {}
const appManifest = readJson(join(NEXT_DIR, 'app-build-manifest.json')) ?? {}

/** Compute a coarse first-load JS size for a page by summing referenced js chunks. */
function routeSize(files = []) {
  return files
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(NEXT_DIR, f))
    .reduce((acc, p) => {
      try {
        return acc + statSync(p).size
      } catch {
        return acc
      }
    }, 0)
}

const routes = new Map()
for (const [path, files] of Object.entries(buildManifest.pages ?? {})) {
  routes.set(path, routeSize(files))
}
for (const [path, files] of Object.entries(appManifest.pages ?? {})) {
  routes.set(path, (routes.get(path) ?? 0) + routeSize(files))
}

const current = Object.fromEntries([...routes.entries()].sort())
console.log('Route first-load JS (bytes):')
for (const [route, size] of Object.entries(current)) {
  console.log(`  ${size.toString().padStart(8)} ${route}`)
}

let failed = false

for (const [route, size] of Object.entries(current)) {
  if (size > BUDGET_BYTES) {
    console.error(`❌ ${route} is ${size} B > budget ${BUDGET_BYTES} B`)
    failed = true
  }
}

const prev = existsSync(CACHE_FILE) ? readJson(CACHE_FILE) ?? {} : {}
for (const [route, size] of Object.entries(current)) {
  const before = prev[route]
  if (typeof before === 'number' && before > 0) {
    const growth = ((size - before) / before) * 100
    if (growth > MAX_GROWTH_PCT) {
      console.error(
        `❌ ${route} grew ${growth.toFixed(1)}% (${before} → ${size} B) > max ${MAX_GROWTH_PCT}%`
      )
      failed = true
    }
  }
}

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
writeFileSync(CACHE_FILE, JSON.stringify(current, null, 2))

if (failed) {
  console.error('\nBundle guard failed. Investigate with `next build --profile` or bundle analyzer.')
  process.exit(1)
}
console.log('Bundle guard passed.')
