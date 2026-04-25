/**
 * Stub for static export (Capacitor). OAuth must use your hosted app URL.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return NextResponse.redirect(new URL('/?fitbit_setup=server', base))
}
