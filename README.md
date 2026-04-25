# FitTrack Go

A fitness tracking web app with GPS runs, an exercise library, and an Coach Assist that uses camera-based pose detection to check form (squats, push-ups, planks, lunges, and more).

## Features

- **Dashboard** — Stats, weekly activity, today’s summary, and quick actions
- **Run tracker** — GPS runs with map, distance, pace, splits, and save to cloud
- **Exercise library** — Browse workouts by category and log completed sessions
- **Coach Assist** — Real-time pose detection and form feedback for 9 exercises
- **Profile** — Name, level, goals, stats, notifications, and support

Data is stored in **Supabase** (auth, profiles, workouts, runs, coach sessions). You need a Supabase project and env vars to run with real data.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # add your Supabase URL and anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Setup

For full setup (Supabase project, database schema, OAuth, etc.), see:

- **[SETUP-CHECKLIST.md](./SETUP-CHECKLIST.md)** — Step-by-step Supabase setup
- **[QUICK-START.md](./QUICK-START.md)** — Short version of the same

Without Supabase configured, the app shows an in-app setup guide instead of the main UI.

## Scripts

| Command     | Description        |
|------------|--------------------|
| `npm run dev`   | Start dev server   |
| `npm run build` | Production build  |
| `npm run start` | Start production   |
| `npm run lint`  | Run ESLint         |
| `npm run test`  | Run unit tests     |
| `npm run ci:check` | Same gates as CI: validate-env, lint, typecheck, test, build, bundle guard |
| `npm run synthetic-checks` | HTTP smoke for `/`, `/api/health`, `/login` (`SYNTHETIC_BASE_URL` for deploys) |
| `npm run test:e2e` | Playwright (run after `npm run build && npm run start`) |

## Release quality

See [docs/PRODUCTION-CHECKLIST.md](./docs/PRODUCTION-CHECKLIST.md) and [docs/API-SECURITY-ROUTES.md](./docs/API-SECURITY-ROUTES.md).

The `out/` directory is a **Next.js static export** output when you use `next export` / static builds; it is gitignored by default. Android/Capacitor flows that generate a static bundle are documented in [ANDROID-BUILD.md](./ANDROID-BUILD.md).

## Tech

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Supabase** — Auth (email/password + OAuth), Postgres
- **MediaPipe Pose Landmarker** — Browser-based pose detection for the Coach Assist
- **Leaflet** — Run map

## Docs

- [BODY-DETECTION-CAPABILITIES.md](./docs/BODY-DETECTION-CAPABILITIES.md) — What the Coach Assist can do and possible improvements
- [DATABASE-SETUP.md](./DATABASE-SETUP.md) — Schema and tables
- [OAUTH-SETUP.md](./OAUTH-SETUP.md) — Google/Apple sign-in
