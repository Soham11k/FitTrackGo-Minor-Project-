# Contributing to FitTrack Go

## Pre-merge quality bar

Run the same checks as CI before opening a PR or merging:

```bash
npm run ci:check
```

This runs `validate-env`, lint, TypeScript, unit tests, production build, bundle guard, i18n key extraction, and the Lighthouse script (see [docs/PERF.md](./docs/PERF.md) for how `lh:audit` behaves locally).

When you change user-facing flows, add or extend Playwright coverage under `e2e/` (guest entry, Coach shell, workout player, auth callback paths). Run `npm run build && npm run start` in one terminal, then `npm run test:e2e` in another.

## Database migrations

After pulling changes that include `supabase/migrations/`, apply them to your project database so runtime optional-column retries do not hide real drift for long:

```bash
npm run db:push
```

See [docs/MIGRATION-CHECKLIST.md](./docs/MIGRATION-CHECKLIST.md) for a short checklist.

## i18n

User-visible strings pulled into `messages/*.json` should stay in sync across locales when you add keys. CI runs `node scripts/extract-i18n-keys.mjs` as part of `ci:check` (warnings only).

## Brand assets

After changing logo, favicon, maskable icons, or Open Graph art, regenerate / sync assets:

```bash
npm run brand:assets
npm run brand:android   # when Capacitor launcher icons must match
```
