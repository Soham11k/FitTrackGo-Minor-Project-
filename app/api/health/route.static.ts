/**
 * Stub for static export (Android / Capacitor). Real health check runs on your deployed server.
 * Swapped in by scripts/prepare-android-build.mjs before build:android.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
    note: 'export-stub',
  })
}
