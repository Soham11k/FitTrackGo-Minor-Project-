# Coach Vision library

This folder is the foundation for the Coach Vision feature set.

| File                 | Purpose                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `faults.ts`          | Structured `FormFault` catalog + per-exercise detectors driving the fault overlay.          |
| `fault-overlay.ts`   | Canvas renderer: red segments + severity-ramped labels for detected faults.                 |
| `hud-metrics.ts`     | Live joint-angle HUD data + per-rep `RomTracker`.                                           |
| `motion-dna.ts`      | 6-axis session fingerprint (Stability, Range, Tempo, Symmetry, Depth, Consistency).         |
| `pose-worker.ts`     | MediaPipe Tasks Vision runner in a dedicated Web Worker.                                    |
| `pose-client.ts`     | Main-thread controller: feeds ImageBitmaps, adaptive FPS, subscribe to landmark frames.     |
| `rep-replay.ts`      | Small ring buffer so the session summary can animate a user's best/worst rep.               |

## Integration checklist (AI Coach UI)

The existing `components/ai-coach.tsx` can adopt these incrementally:

1. Instantiate `PoseClient`, call `init()`, then `start(videoRef.current)`.
2. In `onFrame(frame)`:
   - Run `analyzeForm(frame.landmarks, exerciseId)`.
   - `detectFaults(frame.landmarks, exerciseId, analyzed)` → feed `renderFaults` on the overlay canvas.
   - Update `RomTracker.update(...)` with the primary joint angle.
   - `computeJointAngles(...)` to drive the HUD panel.
   - `RepReplayBuffer.push(frame.landmarks)`.
3. On rep boundary, call `RomTracker.commitRep()`, pushing the rep sample into a `RepSample[]`.
4. On session save, call `computeMotionDna(reps)` and store as `session.motion_dna` (JSON column on `coach_sessions` — add in a later migration when the shape stabilizes).
5. For the summary screen, render `dnaRadarPath(dna)` via SVG and replay the best rep via `replayBuffer.snapshot()`.

## What's deferred to follow-up PRs

- UI wiring inside `ai-coach.tsx` (kept out of this pass to keep the diff reviewable).
- 3D world-landmark visualization — the `worldLandmarks` already come through `PoseFrame`.
- Ghost target pose — depends on a bank of reference rep recordings; TBD.
- Model asset hosting under `public/models/` for offline support; a follow-up PR should copy the `.task` file from storage.googleapis and switch the default model URL.
- Cadence metronome + auto-exercise classifier (hooks into pose-client's `onFrame`).
