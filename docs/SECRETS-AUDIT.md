# Secrets audit

## Rule

Any secret that can make a privileged API call on a user's behalf must live only in:

- Server-side env (Vercel project env with scope "Production" / "Preview"), exposed only to Route Handlers and server components.
- CI env (`SENTRY_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` for seed/migration jobs).

Never prefix such values with `NEXT_PUBLIC_`. If a prefix starts with `NEXT_PUBLIC_`, assume it is leaked to every browser tab.

## Current inventory

| Name                          | Visibility           | Used by                                           | Notes                                                     |
| ----------------------------- | -------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`    | Public               | Browser client                                    | Safe — public project URL.                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public             | Browser client                                    | Safe — anon key protected by RLS.                         |
| `SUPABASE_SERVICE_ROLE_KEY`   | Server / CI only     | `lib/supabase/service-role.ts`, migrate script   | **Never** expose. RLS bypass.                             |
| `FITBIT_CLIENT_ID`            | Server only          | OAuth redirect build                              | Not strictly secret but keep server-side for consistency. |
| `FITBIT_CLIENT_SECRET`        | Server only          | Fitbit token exchange                             | **Never** expose.                                         |
| `SENTRY_DSN`                  | Server               | `sentry.server.config.ts`, `lib/sentry.ts`       | DSN alone is low-risk; still keep off the browser.        |
| `NEXT_PUBLIC_SENTRY_DSN`      | Public (intentional) | `sentry.client.config.ts`                         | Required to report from browsers. DSN is write-only.      |
| `SENTRY_AUTH_TOKEN`           | CI only              | `next.config.mjs` withSentryConfig source maps   | **Never** expose.                                         |
| `NEXT_PUBLIC_POSTHOG_KEY`     | Public               | `lib/analytics.ts`                                | PostHog project API key; safe by design.                  |
| `VAPID_PUBLIC_KEY`            | Public               | `app/api/push/subscribe`                          | Must match private key on the server.                     |
| `VAPID_PRIVATE_KEY`           | Server only          | `app/api/push/send`                               | **Never** expose.                                         |
| `GOOGLE_FIT_CLIENT_SECRET`    | Server only          | Phase 7 adapters                                  | **Never** expose.                                         |
| `GARMIN_CONSUMER_SECRET`      | Server only          | Phase 7 adapters                                  | **Never** expose.                                         |
| `CRON_SECRET`                 | Server only          | `app/api/cron/reminders` (Bearer / `X-Cron-Secret`) | **Never** expose. Rotate with your scheduler.            |
| `PUSH_ADMIN_TOKEN`            | Server only          | `app/api/push/send`                                | **Never** expose. Use for server-side push fan-out only.   |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` | Server / public (pub) | `lib/push/server`, subscribe route          | See push setup; private key server-only.                  |

## Enforcement

- `scripts/validate-env.mjs` runs in CI and locally; failing when required vars are missing in production.
- Reviewers block any PR that adds `NEXT_PUBLIC_*` to a name from the "Server only" column.
- Rotate `SUPABASE_SERVICE_ROLE_KEY`, `FITBIT_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`, and `SENTRY_AUTH_TOKEN` at least every 90 days.

## Historical notes

- 2026-04 audit found no server-only secrets leaking through `NEXT_PUBLIC_*`. The prior Supabase ref hard-coded in `profile-screen.tsx` was removed in the Phase 0 hot fixes.
