# FitTrack Go Global Readiness Roadmap

This roadmap focuses on shipping safely to a global audience in phases.

## Phase 1 (Now) - Quality And Safety Gates

- [x] Enforce strict build type safety (`next.config.mjs` with `ignoreBuildErrors: false`).
- [x] Add CI workflow for lint, typecheck, tests, and production build (`.github/workflows/ci.yml`).
- [x] Add API abuse protection for account deletion (`app/api/delete-account/route.ts` + `lib/rate-limit.ts`).
- [x] Harden browser error UX to avoid leaking internals in production (`app/error.tsx`).

## Phase 2 (Week 1) - Security And Reliability

- [ ] Add distributed rate limiting (Upstash Redis / managed edge KV) for production scale.
- [ ] Add CSRF protection strategy for mutating endpoints.
- [ ] Add audit logs for destructive actions (account deletion, auth-linked profile changes).
- [ ] Add uptime probes for `/`, `/api/health`, login flow, and callback flow.
- [ ] Add explicit incident runbook and rollback checklist.

## Phase 3 (Week 2) - Observability

- [ ] Add Sentry (frontend + server) with release/version tagging.
- [ ] Add request correlation IDs in logs and error reports.
- [ ] Create alerting policy for elevated 5xx, auth callback failures, and latency spikes.
- [ ] Define SLOs for API availability and auth success rate.

## Phase 4 (Week 3) - Internationalization

- [ ] Add i18n framework (`next-intl`) with route-level locale support.
- [ ] Add locale-aware date/time formatting and unit preference (km/mi, kg/lb).
- [ ] Add language selector and persist locale preference per user profile.
- [ ] Add translated copies for legal pages and auth-related flows.

## Phase 5 (Week 4) - Scale And Product Operations

- [ ] Add caching and revalidation rules for dashboard-heavy reads.
- [ ] Move expensive aggregate analytics into database views/materialized views.
- [ ] Add feature flags for progressive rollout by region/platform.
- [ ] Define data retention/backups and regional compliance requirements.
- [ ] Add Android/iOS release automation and post-release crash monitoring.

## Definition Of Global-Ready

You are global-ready when:

1. CI blocks bad builds and all checks are required on pull requests.
2. Security controls (rate limit, CSRF, auth boundaries, audit logging) are enforced.
3. Observability can detect and triage failures quickly.
4. Product UX adapts by locale/timezone and supports multi-region users.
5. Runbooks exist for outages, data recovery, and release rollback.
