/**
 * Stub for static export (Capacitor). Fitbit sync runs on your deployed server.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function POST() {
  return NextResponse.json({ error: "Wearables sync is not available in this build." }, { status: 503 })
}
