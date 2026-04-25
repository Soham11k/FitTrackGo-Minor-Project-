/**
 * Stub for static export (Capacitor).
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({
    ok: true,
    fitbitConfigured: false,
    connected: false,
    note: "Vitals load from your hosted app when API routes are available.",
  })
}
