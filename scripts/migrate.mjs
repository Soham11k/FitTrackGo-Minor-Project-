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
 * If `SUPABASE_DB_URL` is unset, loads `.env.local` and builds a URL from:
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD
 * (password = the one you set when creating the Supabase project; Settings → Database.)
 *
 * Optional: SUPABASE_POOLER_REGION — if set, that pooler region is tried first when expanding URLs.
 *
 * If `SUPABASE_DB_URL` is set, it is tried first, then the same project ref + password are used to
 * try session poolers in every known region and finally direct `db.*` (so one wrong region in the
 * URI does not strand you on a single timeout).
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { resolve4, resolve6 } from 'node:dns/promises'
import { parse as parsePgConn } from 'pg-connection-string'

function loadDotEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = val
  }
}

const DEFAULT_POOLER_REGIONS = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'sa-east-1',
]

function canonicalSupabasePublicUrl(raw) {
  const s = (raw || '').trim().replace(/\/$/, '')
  if (!s) return ''
  try {
    const u = new URL(s)
    if (/\.supabase\.co$/i.test(u.hostname)) {
      const p = u.pathname.replace(/\/$/, '') || '/'
      if (p === '/rest/v1' || p.startsWith('/rest/v1/')) return u.origin
    }
    return s
  } catch {
    return (raw || '').trim()
  }
}

function supabaseRefFromPublicUrl(publicUrl) {
  try {
    const host = new URL(canonicalSupabasePublicUrl(publicUrl)).hostname
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function regionFromPoolerHost(host) {
  const h = (host || '').split(':')[0]
  const m = h.match(/^aws-0-([a-z0-9-]+)\.pooler\.supabase\.com$/i)
  return m ? m[1] : null
}

/**
 * When the user sets SUPABASE_DB_URL, still try other session poolers + direct host.
 * A single wrong region or flaky endpoint should not be the only attempt.
 * @param {string} explicitUrl
 * @returns {string[]}
 */
function expandSupabaseCandidates(explicitUrl) {
  let parsed
  try {
    parsed = parsePgConn(explicitUrl)
  } catch {
    return [explicitUrl]
  }
  const password = parsed.password
  if (password == null || password === '') return [explicitUrl]

  const user = (parsed.user || '').trim()
  const host = (parsed.host || '').trim().split(':')[0]

  let ref = null
  const poolerUser = user.match(/^postgres\.([a-z0-9]+)$/i)
  if (poolerUser) ref = poolerUser[1]
  else if (/^postgres$/i.test(user)) {
    const mh = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
    if (mh) ref = mh[1]
  }

  if (!ref) return [explicitUrl]

  const enc = encodeURIComponent(password)
  const direct = `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`

  const fromHost = regionFromPoolerHost(host)
  const fromEnv = process.env.SUPABASE_POOLER_REGION?.trim()
  const primary = fromEnv || fromHost
  const regions = primary
    ? [primary, ...DEFAULT_POOLER_REGIONS.filter((r) => r !== primary)]
    : [...DEFAULT_POOLER_REGIONS]

  const poolers = regions.map(
    (r) =>
      `postgresql://postgres.${ref}:${enc}@aws-0-${r}.pooler.supabase.com:5432/postgres`
  )

  const out = []
  const seen = new Set()
  function push(u) {
    if (!u || seen.has(u)) return
    seen.add(u)
    out.push(u)
  }
  push(explicitUrl)
  for (const u of poolers) push(u)
  push(direct)
  return out
}

/**
 * Ordered list of Postgres URLs to try. Session pooler endpoints usually resolve to IPv4;
 * direct `db.*.supabase.co` is often IPv6-only (fails with EHOSTUNREACH on many networks).
 * @returns {string[]}
 */
function buildConnectionUrlCandidates() {
  const explicit = process.env.SUPABASE_DB_URL?.trim()
  if (explicit) return expandSupabaseCandidates(explicit)

  const password = process.env.SUPABASE_DB_PASSWORD?.trim()
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!password || !publicUrl) return []

  const ref = supabaseRefFromPublicUrl(publicUrl)
  if (!ref) return []

  const enc = encodeURIComponent(password)
  const direct = `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`
  const regionFirst = process.env.SUPABASE_POOLER_REGION?.trim()
  const regions = regionFirst
    ? [regionFirst, ...DEFAULT_POOLER_REGIONS.filter((r) => r !== regionFirst)]
    : DEFAULT_POOLER_REGIONS

  const poolers = regions.map(
    (r) =>
      `postgresql://postgres.${ref}:${enc}@aws-0-${r}.pooler.supabase.com:5432/postgres`
  )

  /* Poolers first (IPv4-friendly); direct host is often IPv6-only (EHOSTUNREACH on many networks). */
  return [...poolers, direct]
}

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

loadDotEnvLocal()
const dbUrlCandidates = buildConnectionUrlCandidates()
if (dbUrlCandidates.length > 1) {
  console.log(`Will try up to ${dbUrlCandidates.length} Postgres endpoints until one connects.`)
}
if (dbUrlCandidates.length === 0) {
  console.error(
    'No database connection. Do one of:\n' +
      '  • Set SUPABASE_DB_URL (Postgres URI from Supabase → Settings → Database), or\n' +
      '  • Add SUPABASE_DB_PASSWORD to .env.local (database password you chose for the project)\n' +
      '    alongside NEXT_PUBLIC_SUPABASE_URL, then run again.\n' +
      '  Use --dry-run to preview migration files.'
  )
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

/**
 * Supabase `db.*.supabase.co` often publishes only AAAA records; Node's default
 * `dns.lookup` used by `pg` can return ENOTFOUND. Resolve A/AAAA explicitly.
 */
async function pgClientConfigFromUrl(connectionString) {
  const parsed = parsePgConn(connectionString)
  const useSsl = /\.supabase\.co/i.test(connectionString)
  let host = (parsed.host || '').split(':')[0]
  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
  const isIPv6Literal = host.includes(':')
  /* Pooler TLS may require the real hostname (SNI); do not substitute an A-record IP. */
  const isPoolerHost = /\.pooler\.supabase\.com$/i.test(host)
  if (host && !isIPv4 && !isIPv6Literal && !isPoolerHost) {
    try {
      const v4 = await resolve4(host)
      if (v4.length) host = v4[0]
    } catch {
      try {
        const v6 = await resolve6(host)
        if (v6.length) host = v6[0]
      } catch {
        /* keep hostname; pg will resolve */
      }
    }
  }
  return {
    user: parsed.user,
    password: parsed.password,
    host,
    port: parsed.port,
    database: parsed.database,
    connectionTimeoutMillis: 18_000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  }
}

function maskConnectionHint(url) {
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@').replace(/:[^:@]+@pooler\./, ':***@pooler.')
}

function isRetriableConnectError(err) {
  const c = err && err.code
  const msg = err && typeof err.message === 'string' ? err.message : ''
  /* `pg` uses message "timeout expired" without always setting err.code */
  if (/timeout/i.test(msg)) return true
  return (
    c === 'EHOSTUNREACH' ||
    c === 'ENETUNREACH' ||
    c === 'ECONNREFUSED' ||
    c === 'ETIMEDOUT' ||
    c === 'ENOTFOUND'
  )
}

async function connectFirstWorking(urls) {
  const { default: pg } = await import('pg')
  let lastErr
  for (const url of urls) {
    try {
      const cfg = await pgClientConfigFromUrl(url)
      const client = new pg.Client(cfg)
      await client.connect()
      console.log(`Connected: ${maskConnectionHint(url)}`)
      return client
    } catch (e) {
      lastErr = e
      if (isRetriableConnectError(e)) {
        console.warn(`  (skip) ${maskConnectionHint(url)} — ${e.code || e.message}`)
        continue
      }
      throw e
    }
  }
  const hint =
    'All endpoints failed to connect. Your pooler URL and region may be correct; many networks block outbound Postgres (port 5432). Try disabling VPN or a phone hotspot, or run `npm run db:bundle` and paste `supabase/_run_in_sql_editor.sql` into Supabase → SQL Editor → Run.'
  console.error(hint)
  throw lastErr
}

async function main(urls) {
  const client = await connectFirstWorking(urls)

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

main(dbUrlCandidates).catch((err) => {
  console.error(err)
  process.exit(1)
})
