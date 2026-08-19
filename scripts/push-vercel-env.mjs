#!/usr/bin/env node
/**
 * Push Supabase-related vars from .env.local → Vercel **Production** only.
 * (Preview needs a git branch: `vercel env add NAME preview <branch> --value ...`)
 *
 * Usage: node scripts/push-vercel-env.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const envPath = path.join(root, ".env.local")

function parseDotEnv(raw) {
  const out = {}
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function runVercelEnvAdd(name, environment, value, flags) {
  const args = ["vercel@54.0.0", "env", "add", name, environment, "--value", value, "--yes", "--force", ...flags]
  const r = spawnSync("npx", args, { cwd: root, stdio: "inherit", env: process.env })
  if (r.status !== 0) {
    console.error(`Failed: vercel env add ${name} ${environment}`)
    process.exit(r.status ?? 1)
  }
}

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "FITBIT_CLIENT_ID",
  "FITBIT_CLIENT_SECRET",
  "FITBIT_REDIRECT_URI",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
]

function isPlaceholder(value) {
  const v = value.trim().toLowerCase()
  return (
    !v ||
    v.includes("your-project") ||
    v.includes("your_anon") ||
    v.includes("your-service-role") ||
    v.startsWith("your-")
  )
}

function skipAppUrl(value) {
  const v = value.trim().toLowerCase()
  return v.includes("localhost") || v.includes("127.0.0.1") || v.includes("0.0.0.0")
}

if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local — create it first (see .env.local.example).")
  process.exit(1)
}

const env = parseDotEnv(fs.readFileSync(envPath, "utf8"))

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
if (supabaseUrl && !isPlaceholder(supabaseUrl)) {
  try {
    const host = new URL(supabaseUrl).hostname
    console.error(`\nSupabase host in .env.local: ${host}`)
    console.error("Run npm run check:supabase-host — paused/deleted projects break auth on Vercel.")
  } catch {
    console.error("\nWarning: NEXT_PUBLIC_SUPABASE_URL is not a valid URL.")
  }
}

let pushed = 0
for (const key of KEYS) {
  const value = env[key]
  if (!value || isPlaceholder(value)) continue
  if (key === "NEXT_PUBLIC_APP_URL" && skipAppUrl(value)) {
    console.error(`\n⊘ ${key} skipped (still localhost — set your https://….vercel.app URL in Vercel Dashboard)`)
    continue
  }
  const sensitive =
    key.includes("KEY") ||
    key.includes("SECRET") ||
    key.includes("PASSWORD") ||
    key.includes("TOKEN") ||
    key === "OPENAI_API_KEY"
  const flags = sensitive ? ["--sensitive"] : []
  console.error(`\n→ ${key} → production`)
  runVercelEnvAdd(key, "production", value, flags)
  pushed += 1
}

if (pushed === 0) {
  console.error("\nNo env vars pushed. Fill .env.local from .env.local.example first.")
  process.exit(1)
}

console.error("\nDone. Redeploy: npm run deploy:vercel")
