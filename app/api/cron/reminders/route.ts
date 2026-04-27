/**
 * Stub for static export (Capacitor). Cron runs only on your deployed server.
 */
import { NextResponse } from "next/server"

export const dynamic = "force-static"

export async function GET() {
  return NextResponse.json(
    { error: "Cron reminders are not available in this build." },
    { status: 503 }
  )
}
