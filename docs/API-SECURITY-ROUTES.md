# API route security (quick reference)

Server routes live under `app/api/`. This document summarizes **authentication**, **rate limiting**, and **secrets** for production review. Pair with [SECRETS-AUDIT.md](./SECRETS-AUDIT.md) and [RLS-AUDIT.md](./RLS-AUDIT.md).

## Authenticated user (Supabase session)

| Route | Method | Auth | Notes |
| --- | --- | --- | --- |
| `app/api/push/subscribe` | POST | `createClient()` + `getUser()` | Service role used for DB upsert; rate-limited per user (`lib/rate-limit.ts`). |
| `app/api/wearables/*/auth` | GET | Often starts OAuth; user session for linking | Full redirect to provider. |
| `app/api/wearables/*/callback` | GET | OAuth state | Exchanges code for tokens. |
| `app/api/wearables/*/disconnect` | POST | Session or token pattern in route | See implementation. |
| `app/api/ai-coach/review-clip` | POST | `createClient()` + `getUser()` | **Requires signed-in user.** Sends sampled **image frames** (data URLs) to OpenAI vision when configured; `OPENAI_API_KEY` must be set or route returns **503**. Rate limit: **4 / 5 min** per user. |

## OpenAI-backed coach routes (shared limits / configuration)

All of the following require **`OPENAI_API_KEY`** on the server; individual routes return **503** with `not_configured` when it is missing. **They are not substitutes for on-device scoring** — they add LLM overlays and optional fallbacks.

| Route | Method | Auth | Rate limit key | Notes |
| --- | --- | --- | --- | --- |
| `app/api/ai-coach/chat` | POST | **None (IP-based)** | `aicoach:<clientIp>` — **12 / min** | Session metrics and user message only (no raw video URL in typical flow); still treat as sensitive context. |
| `app/api/ai-coach/chat` | GET | N/A | — | `{ enabled: boolean }` — whether OpenAI is configured (for client UI). |
| `app/api/ai-coach/score-pose` | POST | Optional session | `coach-score-pose:<user.id \|\| "anon">` — **8 / min** | Fallback scorer when no FormSpec; body is **numeric angles**, not images. |
| `app/api/ai-coach/tip` | POST | Optional session | `coach-tip:<user.id \|\| "anon">` — **6 / min** | Mid-set coaching bursts. |

**Review:** Prefer **authenticated + per-user** limits for any route that accepts rich session context if abuse becomes an issue; today `chat` is IP-throttled only.

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

## Development-only / diagnostics

| Route | Method | Notes |
| --- | --- | --- |
| `app/api/diag/supabase-proxy` | GET | **404 outside `NODE_ENV=development`.** Connectivity / proxy diagnostics; may probe Supabase with configured keys — do not expose in production builds as a public diagnostic. |
| `app/api/supabase-dev-proxy/*` | * | Dev proxy for local Supabase reachability — review before enabling outside trusted dev environments. |
| `app/api/debug-session-log`, `debug-terminal-snapshot` | POST | **404 outside development** (or gated); local debugging only. |

## Rate limiting

Shared helper: `checkRateLimit` in [`lib/rate-limit.ts`](../lib/rate-limit.ts). Multi-instance production should set `UPSTASH_REDIS_*` and enable distributed limiting via `FEATURE_DISTRIBUTED_RATE_LIMIT` (see [`lib/feature-flags.ts`](../lib/feature-flags.ts)).

## Actions after deploy

1. Confirm `CRON_SECRET` and Vercel Cron (or other scheduler) use the same value.
2. Set `PUSH_ADMIN_TOKEN` for internal push fan-out; keep distinct from `CRON_SECRET` if you want separate rotation.
3. Re-run RLS policies in Supabase for any new tables touching user data.
4. Set `OPENAI_API_KEY` only on the server; never expose it in `NEXT_PUBLIC_*`. Confirm `review-clip` and other coach routes behave as expected (503 when unset).
