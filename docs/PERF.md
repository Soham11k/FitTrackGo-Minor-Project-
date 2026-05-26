# Performance notes (FitTrack Go)

This file records **measurement posture** and **known heavy paths**. Fill in Lighthouse numbers when you run a real audit against a deployed URL.

## Lighthouse baseline

| When        | URL | Device / channel | Perf | A11y | BP | SEO | Notes |
|-------------|-----|------------------|------|------|----|-----|-------|
| _YYYY-MM-DD_ | _e.g. production origin_ | Mobile / LHCI defaults | — | — | — | — | `RUN_LHCI=1` + `LHCI_URL=...` (see below) |

### How we run Lighthouse in this repo

- Script: `npm run lh:audit` → [`scripts/lighthouse-audit.mjs`](../scripts/lighthouse-audit.mjs).
- By default the script **exits 0** without running Lighthouse unless you set:

  ```bash
  RUN_LHCI=1 LHCI_URL=https://your-deployment.example.com npm run lh:audit
  ```

  Wire your LHCI / `@lhci/cli` pipeline there when you want CI-enforced budgets.
- GitHub Actions may run a separate Lighthouse job (see workflow + [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md)).

## Code splitting & route weight

- Main shell (`app/page.tsx`) loads heavy tabs with `next/dynamic` and `ssr: false` (Run, Exercises, Coach, Arena) so the first paint does not pay for MediaPipe, maps, or large coach bundles up front.
- Prefer keeping new **tab-level** features behind `dynamic()` with a small loading placeholder.

## MediaPipe / pose

- Coach and workout camera use `@mediapipe/tasks-vision` from [`lib/pose-detection.ts`](../lib/pose-detection.ts). WASM and model assets are network-dependent; low-end devices may see **mirror-only** mode until the model is ready (see UI copy in [`components/workout-step-camera.tsx`](../components/workout-step-camera.tsx)).
- **Future tuning:** consider explicit lite/heavy model selection or stricter FPS gating per device tier; keep pose work out of unrelated render paths.

## Service worker (`public/sw.js`)

- **Shell cache:** versioned cache `fittrackgo-shell-v2` precaches `/offline`, `/marketing`, `/manifest.json`, and a brand icon — not the full app.
- **Auth navigations:** `GET` requests under `/auth` use `fetch` with a **no-store HTML fallback** instead of the offline dashboard shell, so magic-link / OAuth flows are less likely to look “stuck offline.”
- **Other documents:** on network failure, the SW may return a cached document or `/offline`. That can **mask** transient server errors during development — if auth or API errors look wrong, disable the SW or use a hard refresh.

Record any policy changes here when you adjust caching.
