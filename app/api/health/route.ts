import { NextResponse } from 'next/server'
import { getEnvStatus } from '@/lib/env'

export const runtime = 'edge'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const env = getEnvStatus()
  const payload = {
    status: env.ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
    env: env.ok ? undefined : { missing: env.missing },
  }
  return NextResponse.json(payload, { status: env.ok ? 200 : 503 })
}
