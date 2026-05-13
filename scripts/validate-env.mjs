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
  const v = env[key]?.trim() ?? ''
  if (!v) return true
  const lower = v.toLowerCase()
  if (
    lower.includes('your-project') ||
    lower.includes('your-anon-key') ||
    lower.includes('your_project_ref') ||
    lower.includes('your_anon_key')
  ) {
    return true
  }
  return false
})

if (missing.length > 0) {
  console.error('Missing required env:', missing.join(', '))
  process.exit(1)
}
if (!env.OPENAI_API_KEY?.trim()) {
  console.warn(
    'Optional: OPENAI_API_KEY is not set — AI coach (/api/ai-coach/chat) will return 503 until you add it. See .env.local.example.',
  )
}
console.log('Env validation OK')
