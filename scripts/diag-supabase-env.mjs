#!/usr/bin/env node
/**
 * Prints URL hostname ref vs legacy anon JWT ref (no secrets). Writes one NDJSON line to
 * `.cursor/debug-ada955.log` when present for Cursor debug sessions.
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  readFileSync(path, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)/)
      if (!m) return
      out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    })
  return out
}

const envPath = join(root, '.env.local')
const fileEnv = parseEnvFile(envPath)
/** Prefer `.env.local` over inherited `process.env` so CI/shell anon keys cannot spoof diag output. */
const rawUrl = (fileEnv.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const anon = (fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

if (!rawUrl || !anon) {
  console.error(
    'diag-supabase-env: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (set in .env.local or env)'
  )
  process.exit(1)
}

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

function legacyJwtProjectRef(anonKey) {
  const k = (anonKey || '').trim()
  if (!k.startsWith('eyJ')) return null
  try {
    const segment = k.split('.')[1]
    if (!segment) return null
    const json = Buffer.from(segment, 'base64url').toString('utf8')
    const payload = JSON.parse(json)
    let raw = typeof payload.ref === 'string' ? payload.ref : null
    if (!raw && typeof payload.iss === 'string') {
      const m = payload.iss.match(/^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/i)
      raw = m ? m[1] : null
    }
    if (!raw) return null
    return String(raw)
      .trim()
      .toLowerCase()
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
  } catch {
    return null
  }
}

function urlHostnameRef(canon) {
  try {
    const host = new URL(canon).hostname.toLowerCase()
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

function debugLog(payload) {
  try {
    mkdirSync(join(root, '.cursor'), { recursive: true })
    appendFileSync(join(root, '.cursor', 'debug-ada955.log'), JSON.stringify(payload) + '\n')
  } catch {
    /* noop */
  }
}

const canon = canonicalSupabasePublicUrl(rawUrl)
const urlRef = urlHostnameRef(canon)
const jwtRef = anon.startsWith('eyJ') ? legacyJwtProjectRef(anon) : null
const match = Boolean(urlRef && jwtRef && urlRef === jwtRef)
const mismatch = Boolean(urlRef && jwtRef && urlRef !== jwtRef)
const jwtDecodeFailed = anon.startsWith('eyJ') && jwtRef == null

const payload = {
  sessionId: 'ada955',
  hypothesisId: 'DIAG_CLI',
  location: 'scripts/diag-supabase-env.mjs',
  message: 'supabase_env_diag',
  data: {
    urlRef,
    jwtRef,
    anonShape: anon.startsWith('eyJ') ? 'legacy_jwt' : anon.startsWith('sb_publishable_') ? 'publishable' : 'other',
    match,
    mismatchDevAutofix: mismatch,
    jwtDecodeFailed,
    envLocalUsed: existsSync(envPath),
  },
  timestamp: Date.now(),
}
debugLog(payload)

console.log('Supabase env diagnostic (refs only, no keys printed):')
console.log('  .env.local    :', existsSync(envPath) ? envPath : '(missing — using process.env only)')
console.log('  URL host ref :', urlRef ?? '(unparsed)')
console.log(
  '  Anon JWT ref :',
  jwtRef ?? (anon.startsWith('sb_publishable_') ? '(publishable — no JWT ref)' : '(none)')
)
if (match) {
  console.log('  Verdict      : MATCH — URL and legacy anon JWT describe the same project.')
} else if (mismatch) {
  console.log('  Verdict      : MISMATCH')
  console.log('  Dev server   : autocorrects API host to https://' + jwtRef + '.supabase.co (see console.warn).')
  console.log('  Production   : next build / next start will fail validation until .env matches.')
  console.log('  Fix          : set NEXT_PUBLIC_SUPABASE_URL=https://' + jwtRef + '.supabase.co OR paste anon from that URL\'s project.')
} else if (jwtDecodeFailed) {
  console.log('  Verdict      : INCOMPLETE — anon looks like JWT but ref could not be decoded (trim/key corruption?).')
} else {
  console.log('  Verdict      : INCOMPLETE — check URL shape (*.supabase.co) or anon key format.')
}

process.exit(0)
