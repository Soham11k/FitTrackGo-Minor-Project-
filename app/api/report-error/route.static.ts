/**
 * Stub for static export (Android / Capacitor). Client error reports need a hosted API.
 * Swapped in by scripts/prepare-android-build.mjs before build:android.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function POST() {
  return NextResponse.json({ ok: true })
}
