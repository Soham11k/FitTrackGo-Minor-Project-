export type FeatureFlags = {
  distributedRateLimit: boolean
  syntheticChecks: boolean
  strictAuthFailures: boolean
}

function envBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback
  return value === '1' || value.toLowerCase() === 'true'
}

export function getFeatureFlags(): FeatureFlags {
  return {
    distributedRateLimit: envBool(process.env.FEATURE_DISTRIBUTED_RATE_LIMIT, true),
    syntheticChecks: envBool(process.env.FEATURE_SYNTHETIC_CHECKS, true),
    strictAuthFailures: envBool(process.env.FEATURE_STRICT_AUTH_FAILURES, false),
  }
}
