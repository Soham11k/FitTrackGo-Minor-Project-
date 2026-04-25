/**
 * Stub for static export (Capacitor).
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function POST() {
  return NextResponse.json({ error: "Wearables API is not available in this build." }, { status: 503 })
}
