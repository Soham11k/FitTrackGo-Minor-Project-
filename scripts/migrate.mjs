#!/usr/bin/env node
/**
 * Database migration runner.
 *
 * Usage:
 *   SUPABASE_DB_URL=postgres://...  node scripts/migrate.mjs            # push
 *   node scripts/migrate.mjs --dry-run                                  # preview
 *   SUPABASE_DB_URL=...             node scripts/migrate.mjs --seed     # also run seed.sql
 *   SUPABASE_DB_URL=...             node scripts/migrate.mjs --reset    # drop+recreate public schema then re-apply
 *
 * Prefers direct Postgres via `pg` (cleanest) and falls back to a REST RPC
 * when only a Supabase service-role URL/key is available.
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const seedPath = join(process.cwd(), 'supabase', 'seed.sql')
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const reset = args.has('--reset')
const seed = args.has('--seed') || reset

let files = []
try {
  files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
} catch {
  console.log('No migrations directory found at supabase/migrations/')
  process.exit(0)
}

if (files.length === 0 && !seed) {
  console.log('No migration files found.')
  process.exit(0)
}

console.log(`Found ${files.length} migration(s)`)
for (const file of files) console.log(`  • ${file}`)
if (seed && existsSync(seedPath)) console.log(`  • (seed) ${seedPath}`)

if (dryRun) {
  console.log('Dry run complete.')
  process.exit(0)
}

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('Set SUPABASE_DB_URL to run. Use --dry-run to preview.')
  process.exit(1)
}

async function exec(client, label, sql) {
  try {
    await client.query(sql)
    console.log(`  ✓ ${label}`)
  } catch (err) {
    console.error(`  ✗ ${label}`)
    console.error(`    ${err.message}`)
    process.exit(1)
  }
}

async function main() {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: dbUrl })
  await client.connect()

  try {
    if (reset) {
      console.log('Resetting public schema...')
      await exec(
        client,
        'reset public',
        'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
      )
    }

    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      await exec(client, file, sql)
    }

    if (seed && existsSync(seedPath)) {
      const sql = readFileSync(seedPath, 'utf8')
      await exec(client, 'seed.sql', sql)
    }

    console.log('Done.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
