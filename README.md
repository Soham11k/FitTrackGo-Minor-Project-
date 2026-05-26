# FitTrack Go

**Train with proof** — FitTrack Go is a browser-native fitness companion where **coach sessions, replay, Arena duels, and share cards lean on verified rep traces** — not blindly typed logs. The Coach Assist analyzes **50+ distinct FormSpec movements** (squat family, bench / row patterns, push-up variants, core drills, cardio, and more — see [`data/form-specs/`](data/form-specs/)) via **MediaPipe pose on your device**.

## Features

- **Dashboard** — Today cues (including wearable readiness → Mobility Coach), streaks, quick actions, and **Program hub** wired into Coach intents
- **Run tracker** — GPS runs with map, distance, pace, splits (supporting capability; headline is Coach + proof)
- **Exercise library** — Browse seeded workouts — “Practice” opens Coach with the matching FormSpec where possible
- **Coach Assist** — Two-step picker (family → variant), Session DNA recap, replay + compare + Arena CTAs
- **Arena** — Async **form duels** per Coach movement label, optional cloud codes via Supabase `form_duels`
- **Profile** — Goals, wearable links, replay preferences, Face enrollment for verified sessions

Data is stored in **Supabase** (auth, profiles, workouts, runs, coach sessions, programs when configured).

## Quick start

```bash
npm install
cp .env.local.example .env.local   # add your Supabase URL and anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Guest “proof-first” entry

Tap **Continue as guest** / **Try verified Coach** — you skip account creation until after a coach session recap (Sessions still need sign-in for cloud sync).

## Setup

For full Supabase wiring (OAuth, migrations, Arena `form_duels` RPC), see:

- **[SETUP-CHECKLIST.md](./SETUP-CHECKLIST.md)** — Step-by-step
- **[QUICK-START.md](./QUICK-START.md)** — Short version

Without Supabase env keys, you’ll see the in-app setup wizard.

Arena cloud duels require migration [`supabase/migrations/20260901000000_form_duels.sql`](supabase/migrations/20260901000000_form_duels.sql).

The Home **Program hub** needs the training-program migrations (schema + catalog seed [`20260801000001_training_program_catalog_seed.sql`](supabase/migrations/20260801000001_training_program_catalog_seed.sql)); if your database predates seeds, run `npm run db:push` so new migrations apply.

**After pulls:** apply new Supabase migrations so features match the codebase — see [docs/MIGRATION-CHECKLIST.md](./docs/MIGRATION-CHECKLIST.md).

- **Coach clip replay / AI frames** — See **[docs/COACH-CLIP-REPLAY.md](./docs/COACH-CLIP-REPLAY.md)**.

## Scripts

| Command     | Description        |
|------------|--------------------|
| `npm run dev`   | Start dev server   |
| `npm run build` | Production build  |
| `npm run start` | Start production   |
| `npm run lint`  | Run ESLint         |
| `npm run test`  | Run unit tests     |
| `npm run ci:check` | Same gates as CI: validate-env, lint, typecheck, test, build, bundle guard, i18n extract, lh script (see [docs/PERF.md](./docs/PERF.md)) |
| `npm run synthetic-checks` | HTTP smoke for `/`, `/api/health`, `/login` (`SYNTHETIC_BASE_URL` for deploys) |
| `npm run test:e2e` | Playwright (run after `npm run build && npm run start`) |
| `node scripts/generate-brand-assets.mjs` | Regenerate app icons, favicon, and OG brand PNGs |

## Contributing

Pre-merge baseline: **`npm run ci:check`** (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

## Release quality

See [docs/PRODUCTION-CHECKLIST.md](./docs/PRODUCTION-CHECKLIST.md), [docs/PERF.md](./docs/PERF.md), and [docs/API-SECURITY-ROUTES.md](./docs/API-SECURITY-ROUTES.md).

Static export / Capacitor flows live in [ANDROID-BUILD.md](./ANDROID-BUILD.md).

## Tech

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Supabase** — Auth + Postgres (`lib/supabase/`)
- **MediaPipe Pose** — Coach scoring + rep traces locally
- **Leaflet** — Run maps

## Docs

- [BODY-DETECTION-CAPABILITIES.md](./docs/BODY-DETECTION-CAPABILITIES.md)
- [DATABASE-SETUP.md](./DATABASE-SETUP.md)
- [docs/MIGRATION-CHECKLIST.md](./docs/MIGRATION-CHECKLIST.md) — after every pull with new migrations
- [CONNECT-NEW-SUPABASE.md](./docs/CONNECT-NEW-SUPABASE.md) — includes Arena migration ordering
- [OAUTH-SETUP.md](./OAUTH-SETUP.md)
