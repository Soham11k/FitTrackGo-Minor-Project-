#!/usr/bin/env node
/**
 * Verifies NEXT_PUBLIC_SUPABASE_URL resolves in DNS and responds over HTTPS.
 * Reads .env.local the same way as validate-env.mjs (no extra deps).
 * Safe: prints hostname only, not API keys.
 */
import { readFileSync, existsSync } from "fs"
import { pathToFileURL } from "url"
import { resolve4 } from "dns/promises"

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
if (!raw) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing (set it in .env.local).")
  process.exit(1)
}

const canon = canonicalSupabasePublicUrl(raw)

let hostname
try {
  hostname = new URL(canon || raw).hostname
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.")
  process.exit(1)
}

console.log("Checking host:", hostname)

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

try {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12_000)
  const res = await fetch(`${(canon || raw).replace(/\/$/, "")}/rest/v1/`, {
    method: "HEAD",
    signal: ctrl.signal,
  })
  clearTimeout(t)
  console.log("HTTPS reachability:", res.status, "(expected 401 or 400 without auth — connection works)")
} catch (e) {
  console.error("HTTPS fetch failed:", e instanceof Error ? e.message : e)
  process.exit(1)
}

console.log("Supabase host check passed.")
