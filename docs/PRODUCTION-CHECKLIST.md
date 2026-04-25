# FitTrack Go Production Checklist

## Merge bar (local / PR)

Run the same commands CI runs, in order:

```bash
npm run ci:check
```

`ci:check` runs: `validate-env` → `lint:ci` → `typecheck` → `test` → `build` → `bundle-guard`.

On GitHub Actions, the **quality** job additionally runs unit tests **with coverage** (`npm run test -- --coverage`). E2E and Lighthouse run in separate jobs.

## Environment

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` for account deletion API.
- [ ] Optional: set `NEXT_PUBLIC_ERROR_REPORTING_URL`.
- [ ] Optional: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (enables distributed rate limiting when `FEATURE_DISTRIBUTED_RATE_LIMIT` is on).
- [ ] Run `npm run validate-env` in each deploy environment.

## After deploy (staging or production)

Point synthetic HTTP checks at the live origin:

```bash
SYNTHETIC_BASE_URL=https://your-deployment.example.com npm run synthetic-checks
```

This verifies `GET /`, `GET /api/health`, and `GET /login` return 200. Run this from CI (with a secret URL) or manually before a release.

## Security and Reliability

- [ ] Verify security headers are present in deployed responses.
- [ ] Verify `/api/delete-account` returns 429 after burst traffic.
- [ ] Verify CSRF origin protections on mutating routes.
- [ ] Verify `GET /api/health` is 200 in healthy environment.

## Quality Gates (also automated in CI)

- [ ] `npm run lint:ci`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `node scripts/bundle-guard.mjs` (included in `ci:check`)
- [ ] `npm run test:e2e` (Chromium) against a running build when changing flows
- [ ] PRs should pass the **CI** workflow on `main` / `master`

## Monitoring

- [ ] Wire error sink for `NEXT_PUBLIC_ERROR_REPORTING_URL`.
- [ ] Enable uptime monitoring for `/`, `/login`, `/api/health`.
- [ ] Run `npm run synthetic-checks` (with `SYNTHETIC_BASE_URL`) after each production deploy.

## Pre-release (tag / store)

- [ ] `npm run ci:check`
- [ ] `SYNTHETIC_BASE_URL=<prod> npm run synthetic-checks`
- [ ] Optional: Lighthouse via `.lighthouserc.json` (see `npm run build` + `npx @lhci/cli autorun` in CI `lighthouse` job)
