/**
 * Stub used only for static export (Android/Capacitor build).
 * OAuth callback does not run in the APK; use a hosted app URL for Google/Apple sign-in.
 * Swapped in by scripts/prepare-android-build.mjs before build:android.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'
  return NextResponse.redirect(base + '/')
}
