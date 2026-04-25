const requiredServerEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const
const optionalServerEnv = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_ERROR_REPORTING_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const

export type EnvStatus = {
  ok: boolean
  missing: string[]
  optionalMissing: string[]
}

export function getEnvStatus(): EnvStatus {
  const missing = requiredServerEnv.filter((key) => {
    const value = process.env[key]
    return !value || value.includes('your-project') || value.includes('your-anon-key')
  })
  const optionalMissing = optionalServerEnv.filter((key) => !process.env[key])
  return {
    ok: missing.length === 0,
    missing: [...missing],
    optionalMissing: [...optionalMissing],
  }
}

export function assertEnv(): void {
  const { ok, missing } = getEnvStatus()
  if (!ok) {
    throw new Error(`Missing required env: ${missing.join(', ')}. See SETUP-CHECKLIST.md`)
  }
}
