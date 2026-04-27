/**
 * Stub for static export (Capacitor). Wearables API runs on your hosted server.
 */
import { NextResponse } from "next/server"
import { ALL_PROVIDER_IDS } from "@/lib/wearables/providers/types"

export const dynamic = "force-static"

export function generateStaticParams() {
  return ALL_PROVIDER_IDS.map((provider) => ({ provider }))
}

export async function POST() {
  return NextResponse.json(
    { error: "Wearables disconnect is not available in this build." },
    { status: 503 }
  )
}
