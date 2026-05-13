#!/usr/bin/env node
/**
 * Concatenates supabase/migrations/*.sql in filename order into one file for
 * Supabase → SQL Editor when local Postgres (npm run db:push) is blocked (e.g. port 5432).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const outPath = join(process.cwd(), 'supabase', '_run_in_sql_editor.sql')

if (!existsSync(migrationsDir)) {
  console.error('Missing supabase/migrations/')
  process.exit(1)
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  console.error('No .sql files in supabase/migrations/')
  process.exit(1)
}

let buf = `-- =============================================================================
-- FitTrackGo — APPLY FULL FILE IN SUPABASE SQL EDITOR (run once)
--
-- IMPORTANT: Click inside the editor, press Cmd+A (Mac) / Ctrl+A (Windows) to
-- select EVERYTHING, then click Run. If only the bottom lines are selected,
-- only those statements run — tables at the top are never created.
--
-- After success, run supabase/VERIFY_PUBLIC_TABLES.sql and you must see rows.
-- =============================================================================
-- Generated ${new Date().toISOString()} — ${files.length} migration files
-- =============================================================================

`

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8').trimEnd()
  buf += `\n-- ---------- ${file} ----------\n\n${sql}\n\n`
}

writeFileSync(outPath, buf, 'utf8')
console.log(`Wrote ${outPath}`)
console.log('Open Supabase → SQL Editor → New query → paste file contents → Run.')
