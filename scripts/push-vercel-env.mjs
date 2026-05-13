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
  const args = ["vercel@53.4.0", "env", "add", name, environment, "--value", value, "--yes", "--force", ...flags]
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
]

if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local — create it first (see .env.local.example).")
  process.exit(1)
}

const env = parseDotEnv(fs.readFileSync(envPath, "utf8"))

for (const key of KEYS) {
  const value = env[key]
  if (!value) continue
  const sensitive =
    key.includes("KEY") || key.includes("SECRET") || key.includes("PASSWORD")
  const flags = sensitive ? ["--sensitive"] : []
  console.error(`\n→ ${key} → production`)
  runVercelEnvAdd(key, "production", value, flags)
}

console.error("\nDone. Redeploy: npx vercel deploy --prod --yes")
