/**
 * Registry of provider adapters. Adapters opt in here; unknown provider ids
 * raise at request time rather than in type-space.
 */
import type { ProviderId, WearableProviderAdapter } from "./types"
import { fitbitAdapter } from "./fitbit"
import { googleFitAdapter } from "./google-fit"
import { appleHealthAdapter } from "./apple-health"
import { garminAdapter } from "./garmin"

const ADAPTERS: Record<ProviderId, WearableProviderAdapter> = {
  fitbit: fitbitAdapter,
  google_fit: googleFitAdapter,
  apple_health: appleHealthAdapter,
  garmin: garminAdapter,
}

export function getAdapter(id: ProviderId): WearableProviderAdapter | null {
  return ADAPTERS[id] ?? null
}

export function listAdapters(): WearableProviderAdapter[] {
  return Object.values(ADAPTERS)
}

export * from "./types"
