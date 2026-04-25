/**
 * Stub for static export (Capacitor).
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({
    fitbit: {
      configured: false,
      connected: false,
      lastSyncAt: null,
      setupError: undefined,
      setup: {
        oauthCallbackUrl: "",
        reason: "static_export",
        serverHasClientId: false,
        serverHasClientSecret: false,
      },
      latest: null,
    },
  })
}
