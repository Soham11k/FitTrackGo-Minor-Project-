/**
 * Stub for static export (Capacitor). AI coach chat runs on your hosted server.
 * Swapped in by scripts/prepare-android-build.mjs before build:android.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({ enabled: false })
}

export async function POST() {
  return NextResponse.json(
    { error: 'not_configured', message: 'AI coach is not available in the offline export. Use the deployed app.' },
    { status: 503 }
  )
}
