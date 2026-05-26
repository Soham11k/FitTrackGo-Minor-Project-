#!/usr/bin/env node
/**
 * Verifies NEXT_PUBLIC_SUPABASE_URL resolves in DNS and responds over HTTPS.
 * Reads .env.local the same way as validate-env.mjs (no extra deps).
 * Safe: prints hostname only, not API keys.
 */
import dns from "node:dns"
import { readFileSync, existsSync } from "fs"
import { pathToFileURL } from "url"
import { resolve4 } from "dns/promises"

dns.setDefaultResultOrder("ipv4first")

function canonicalSupabasePublicUrl(raw) {
  const s = (raw || "").trim().replace(/\/$/, "")
  if (!s) return ""
  try {
    const u = new URL(s)
    if (/\.supabase\.co$/i.test(u.hostname)) {
      const p = u.pathname.replace(/\/$/, "") || "/"
      if (p === "/rest/v1" || p.startsWith("/rest/v1/")) return u.origin
    }
    return s
  } catch {
    return (raw || "").trim()
  }
}

function errCode(e) {
  let c = e
  for (let i = 0; i < 4 && c; i++) {
    if (typeof c === "object" && c !== null && "code" in c && typeof c.code === "string") {
      return c.code
    }
    c = c instanceof Error ? c.cause : null
  }
  return null
}

const envPath = new URL(".env.local", pathToFileURL(process.cwd() + "/"))
const env = { ...process.env }
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8")
  content.split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)/)
    if (!m) return
    env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  })
}

const raw = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
if (!raw) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing (set it in .env.local).")
  process.exit(1)
}

const canon = canonicalSupabasePublicUrl(raw)
const origin = (canon || raw).replace(/\/$/, "")

let hostname
try {
  hostname = new URL(origin).hostname
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.")
  process.exit(1)
}

const ref = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] ?? null
const dashboardUrl = ref
  ? `https://supabase.com/dashboard/project/${ref}`
  : "https://supabase.com/dashboard"
const healthUrl = `${origin}/auth/v1/health`

console.log("Checking host:", hostname)
console.log("Health URL:", healthUrl)

try {
  await resolve4(hostname)
  console.log("DNS (A): OK — hostname resolves.")
} catch (e) {
  console.error("DNS (A): FAIL —", e instanceof Error ? e.message : e)
  console.error(
    "Fix: use Project URL from Supabase → Settings → API (https://<ref>.supabase.co). Paused/deleted projects often return NXDOMAIN.",
  )
  process.exit(1)
}

async function probe(url, init = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12_000)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" })
  } finally {
    clearTimeout(t)
  }
}

let lastErr = null
const attempts = []

// Same probe the app uses in dev-reachability
if (anon) {
  attempts.push({
    label: "GET /auth/v1/health (with anon key)",
    run: () =>
      probe(healthUrl, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      }),
  })
}

attempts.push({
  label: "HEAD /rest/v1/",
  run: () => probe(`${origin}/rest/v1/`, { method: "HEAD" }),
})

for (const { label, run } of attempts) {
  try {
    const res = await run()
    console.log(`HTTPS (${label}):`, res.status, "— connection works")
    console.log("Supabase host check passed.")
    process.exit(0)
  } catch (e) {
    lastErr = e
    const code = errCode(e)
    console.error(`HTTPS (${label}): failed —`, e instanceof Error ? e.message : e, code ? `(${code})` : "")
  }
}

const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "")
const code = errCode(lastErr)
console.error("")
console.error("=== Cannot fix in app code — Supabase project API is not accepting connections ===")
console.error("")
if (code === "ECONNRESET" || /reset/i.test(msg)) {
  console.error(
    "Your dashboard may show this project as Unhealthy while Settings still load. That matches ECONNRESET here.",
  )
}
console.error("Do this in order:")
console.error(`  1. Open ${dashboardUrl}`)
console.error('  2. If status is Unhealthy or Paused → use "Restart project" (avoid Pause on unhealthy projects)')
console.error(`  3. In Chrome, this must return JSON (not an error page): ${healthUrl}`)
console.error("  4. Re-run: npm run check:supabase-host")
console.error("")
console.error("If restart does not help after 30+ minutes:")
console.error("  • New project → Settings → API → paste new URL + keys into .env.local → run supabase/schema.sql")
console.error("  • Or contact support: https://supabase.com/dashboard/support/new (include project ref)")
console.error("")
console.error("Use FitTrack without cloud auth: login → Continue as guest.")

process.exit(1)
