# Post-session video clip and AI review

The **post-session video clip** and **“what to improve”** breakdown live in the **AI Coach** flow (bottom tab), not on the Dashboard or generic Profile home.

## User path

1. Open **Profile** (optional) → **Settings** → ensure **Record coach set clips** is **on** (default). This saves a WebM plus pose samples on this device only.
2. Open the **AI Coach** tab and run a set with the camera on. Let the preview show video before your first rep so recording can start.
3. Tap **End session** only after you have **at least one rep** — ending with **0 reps** does not save a session or a replay clip, so **Replay set** will not appear.
4. On **Workout Complete**, use:
   - **Coach verdict** and **Coach feedback** for immediate cues.
   - **Replay set** (when shown) to open the replay sheet with the **video player**, pose overlay toggle, and **Rep 1 / Rep 2** jump buttons.
5. In the replay sheet, tap **Get AI review** for a frame-based summary and **top fixes** (requires `OPENAI_API_KEY` in `.env.local` for the server route).

## Why “Replay set” might be missing

- **Clip recording is off** in Profile → re-enable **Record coach set clips**.
- **Camera never became ready** before timeout — start the set only after you see a stable preview.
- **Clip cleared** or **different browser / private mode** — clips live in this device’s storage only, unless cloud clip sync is enabled and configured.

If the sheet opens but says the replay is unavailable, the clip was not saved for that session.

## Where data is stored

| Location | Contents |
|----------|----------|
| Browser **IndexedDB** (`lib/coach-replay/store.ts`) | WebM blob, landmark frames, rep markers |
| Optional **Supabase** `coach_clips` | Encrypted backup when cloud sync + feature flag are on |
| **localStorage** keys `ft-clip-review-{sessionId}` | Cached AI review JSON after **Get AI review** |

There is no sample video in the repo; every clip is from **your** session.

## Code reference

| Area | File |
|------|------|
| Recording + Workout Complete | `components/ai-coach.tsx` |
| Replay sheet + video | `components/coach-replay-sheet.tsx` |
| AI review panel | `components/ai-coach/clip-review-panel.tsx` |
| Review API | `app/api/ai-coach/review-clip/route.ts` |
| Preferences | `lib/coach-replay/prefs.ts` |
| Profile toggles | `components/profile-screen.tsx` |
