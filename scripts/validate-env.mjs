#!/usr/bin/env node
import { readFileSync } from 'fs'
import { pathToFileURL } from 'url'

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
const envPath = new URL('.env.local', pathToFileURL(process.cwd() + '/'))
let envContent = ''
try {
  envContent = readFileSync(envPath, 'utf8')
} catch {
  // In CI, .env.local may not exist; process.env is used.
}

const env = { ...process.env }
envContent.split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)/)
  if (!m) return
  env[m[1]] = m[2].replace(/^["']|["']$/g, '')
})

const missing = required.filter((key) => {
  const v = env[key]
  return !v || v.includes('your-project') || v.includes('your-anon-key')
})

if (missing.length > 0) {
  console.error('Missing required env:', missing.join(', '))
  process.exit(1)
}
console.log('Env validation OK')
