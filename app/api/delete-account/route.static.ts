/**
 * Stub for static export (Capacitor). Account deletion runs on your deployed server.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function POST() {
  return NextResponse.json(
    { error: "Account actions require the hosted app. This build is static-only." },
    { status: 503 }
  )
}
