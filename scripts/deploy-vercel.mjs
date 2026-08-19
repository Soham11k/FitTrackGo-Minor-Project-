#!/usr/bin/env node
/**
 * Production deploy to Vercel (requires `vercel login` or VERCEL_TOKEN).
 *
 * Usage: npm run deploy:vercel
 */
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: process.env, ...opts })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.error("→ validate-env")
run("npm", ["run", "validate-env"])

console.error("\n→ lint:ci + typecheck + build (same as CI quality gate)")
run("npm", ["run", "lint:ci"])
run("npm", ["run", "typecheck"])
run("npm", ["run", "build"])

console.error("\n→ vercel deploy --prod")
run("npx", ["vercel@54.0.0", "deploy", "--prod", "--yes"])

console.error("\nDone. Set env vars with: npm run env:vercel (after vercel login)")
