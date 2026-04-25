# Global Platform Implementation Checklist

This document tracks the production-hardening work implemented for global readiness.

## Implemented

- Strict build/type gate (`next.config.mjs`, TypeScript errors fail build).
- Security headers and disabled `x-powered-by` (`next.config.mjs`).
- Environment validation script and server env status utility (`scripts/validate-env.mjs`, `lib/env.ts`).
- Health endpoint with degraded mode and version metadata (`app/api/health/route.ts`).
- CI workflow for lint, typecheck, tests, and build (`.github/workflows/ci.yml`).
- Structured logging utility (`lib/logger.ts`).
- Request ID propagation in proxy and middleware auth fail-fast timeout.
- Rate limiting foundation with Upstash Redis support and memory fallback (`lib/rate-limit.ts`).
- Delete account API hardened with CSRF origin checks and throttling.
- Feature flag utility for progressive rollout (`lib/feature-flags.ts`).
- i18n utilities for locale parsing and unit formatting (`lib/i18n.ts`).
- Synthetic monitoring script (`scripts/synthetic-checks.mjs`).

## Still Needed (External Setup)

- Configure real `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Configure Upstash REST URL/token for distributed limiter.
- Wire error sink endpoint for `NEXT_PUBLIC_ERROR_REPORTING_URL` (Sentry or custom ingest).
- Add policy/legal implementation details (GDPR requests, retention, DPA).
- Add full browser E2E tests for auth/run/coach/profile flows.

## Recommended Next Iteration

1. Integrate Sentry SDK (client + server) and alert routing.
2. Add per-route rate limits to login/oauth callback endpoints.
3. Implement locale routes and UI language selector.
4. Add synthetic checks to scheduled CI job.
