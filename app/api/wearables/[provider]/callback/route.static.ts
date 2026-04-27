/**
 * Stub for static export (Capacitor). OAuth callbacks are served from your deployed app.
 */
import { NextResponse } from "next/server"
import { ALL_PROVIDER_IDS } from "@/lib/wearables/providers/types"

export const dynamic = "force-static"

export function generateStaticParams() {
  return ALL_PROVIDER_IDS.map((provider) => ({ provider }))
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return NextResponse.redirect(new URL("/", base))
}
