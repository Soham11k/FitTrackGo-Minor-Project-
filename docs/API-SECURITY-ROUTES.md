# API route security (quick reference)

Server routes live under `app/api/`. This document summarizes **authentication**, **rate limiting**, and **secrets** for production review. Pair with [SECRETS-AUDIT.md](./SECRETS-AUDIT.md) and [RLS-AUDIT.md](./RLS-AUDIT.md).

## Authenticated user (Supabase session)

| Route | Method | Auth | Notes |
| --- | --- | --- | --- |
| `app/api/push/subscribe` | POST | `createClient()` + `getUser()` | Service role used for DB upsert; rate-limited per user (`lib/rate-limit.ts`). |
| `app/api/wearables/*/auth` | GET | Often starts OAuth; user session for linking | Full redirect to provider. |
| `app/api/wearables/*/callback` | GET | OAuth state | Exchanges code for tokens. |
| `app/api/wearables/*/disconnect` | POST | Session or token pattern in route | See implementation. |

## Service / cron (shared secret or service role)

| Route | Method | Auth | Secret / header |
| --- | --- | --- | --- |
| `app/api/cron/reminders` | GET | `Authorization: Bearer` or `X-Cron-Secret` | `CRON_SECRET` must match. |
| `app/api/push/send` | POST | `X-Cron-Secret` | Must match `PUSH_ADMIN_TOKEN` (browser never calls this). |
| `app/api/delete-account` | POST | Varies; hosted build uses service role for deletion | Not available in static export (Capacitor uses stub). |

## Public or weakly authenticated

| Route | Method | Notes |
| --- | --- | --- |
| `app/api/health` | GET | Liveness; no secret. |
| `app/api/report-error` | POST | In static export may be a stub; limit abuse in production (rate limit in hosted build when present). |

## Rate limiting

Shared helper: `checkRateLimit` in [`lib/rate-limit.ts`](../lib/rate-limit.ts). Multi-instance production should set `UPSTASH_REDIS_*` and enable distributed limiting via `FEATURE_DISTRIBUTED_RATE_LIMIT` (see [`lib/feature-flags.ts`](../lib/feature-flags.ts)).

## Actions after deploy

1. Confirm `CRON_SECRET` and Vercel Cron (or other scheduler) use the same value.
2. Set `PUSH_ADMIN_TOKEN` for internal push fan-out; keep distinct from `CRON_SECRET` if you want separate rotation.
3. Re-run RLS policies in Supabase for any new tables touching user data.
