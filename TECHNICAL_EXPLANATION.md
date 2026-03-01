# FitTrackGo — Technical Explanation

This document explains the project in technical terms: architecture, data flow, algorithms, and implementation details.

---

## 1. System Overview

FitTrackGo is a client-heavy web application. The front end runs in the browser and performs real-time pose estimation and form analysis on the client using WebAssembly (MediaPipe). The backend (Supabase) provides authentication, a PostgreSQL database with row-level security (RLS), and optional server-side logic. No pose or video data is sent to the server; only metadata (sessions, reps, scores) is persisted after a workout.

**High-level flow:** User authenticates via Supabase Auth → accesses Dashboard, Run Tracker, Exercise Library, or AI Coach. In AI Coach, the client captures video from `getUserMedia`, runs the Pose Landmarker on each frame, derives 33 body landmarks, runs form analysis and rep-phase logic, applies face/center/CK checks, updates rep count with optional posture penalty, and at session end uploads session summary (exercise, reps, score, rep_scores) to Supabase.

---

## 2. Technology Stack

| Layer | Technology | Role |
|-------|------------|------|
| Frontend framework | Next.js 16, React 19 | Routing, SSR/CSR, UI |
| Language | TypeScript | Type safety, maintainability |
| Styling | Tailwind CSS 4, Radix UI | Layout, components, accessibility |
| Pose estimation | @mediapipe/tasks-vision (Pose Landmarker) | 33-landmark skeleton from video frames |
| Runtime for ML | WebAssembly (MediaPipe) | Runs pose model in browser (GPU delegate when available) |
| Auth & database | Supabase (PostgreSQL + Auth) | Users, profiles, workouts, runs, coach_sessions, favorites |
| Client–server | Supabase JS client, RLS | Secure, per-user CRUD |
| Maps | Leaflet | Run route display |
| Charts | Recharts | Dashboard and activity charts |

Pose and form logic are implemented in TypeScript modules (`pose-detection.ts`, `form-analysis.ts`, `face-verification.ts`, `center-check.ts`) and run entirely in the browser.

---

## 3. Pose Detection Pipeline

**Initialization:** The app loads the MediaPipe Vision Tasks WASM runtime from a CDN and instantiates the Pose Landmarker. It first tries the “Heavy” model (higher accuracy); on failure it falls back to the “Lite” model. Configuration: `runningMode: "VIDEO"`, `numPoses: 1`, confidence thresholds 0.4. The landmarker is a singleton; once created, the same instance is reused for all frames.

**Per-frame pipeline:**

1. **Input:** A single video frame (from a `<video>` element bound to a camera stream) and a timestamp.
2. **Detection:** `landmarker.detectForVideo(video, timestamp)` returns up to one pose: an array of 33 landmarks. Each landmark has normalized image coordinates `(x, y)` in [0, 1], optional `z` (relative depth), and `visibility` in [0, 1].
3. **Validation:** Landmarks are checked for basic validity (e.g., shoulder/hip geometry) to reject obviously invalid poses.
4. **Interpolation:** Missing or low-visibility landmarks can be filled from neighboring landmarks using a connectivity graph (e.g., shoulders, hips, elbows, knees).
5. **Smoothing:** An exponential moving average (and optional history buffer) is applied to reduce jitter: `smoothed = α * current + (1 − α) * previous`, with α possibly adapted by visibility. Smoothed landmarks are used for both rendering and downstream logic.
6. **Output:** A `PoseResult` containing `landmarks` (and optionally `worldLandmarks` for 3D) is returned to the caller.

**Landmark indices (MediaPipe convention):** 0–10 face (nose, eyes, ears, mouth), 11–12 shoulders, 13–14 elbows, 15–22 wrists/fingers, 23–24 hips, 25–26 knees, 27–28 ankles, 29–32 feet. These indices are used consistently in form analysis, rep phase, face signature, and center check.

---

## 4. Form Analysis

Form analysis is implemented in `form-analysis.ts` and is exercise-specific. It consumes the 33 landmarks and produces a **form score** (0–100), a **good-form flag**, a **breakdown** (per-criterion values and pass/fail), and **feedback** strings.

**Angle computation:** For any three points *A*, *B*, *C*, the angle at *B* is computed using the dot product of vectors *BA* and *BC*:  
`angle = arccos((BA · BC) / (|BA| |BC|))` in degrees. This is used for knee, elbow, back, and other joint angles.

**Exercise-specific logic (examples):**

- **Squat:** Knee angle (hip–knee–ankle), back angle (shoulder–hip–knee), knee tracking (knee vs ankle x-position to detect cave-in), depth (hip vs knee height), symmetry (left vs right knee angle). Thresholds define “good” ranges (e.g., knee 70–110°, back 30–80°). Each violated criterion subtracts points from an initial score of 100.
- **Push-up:** Elbow angle, body line (shoulder–hip–ankle alignment), hip sag, elbow flare (width vs shoulder width). Again, deductions for deviations.
- **Plank, lunge, bicep curl, shoulder press, jumping jacks, high knees, crunch:** Each has its own set of landmarks and rules (angles, positions, symmetry). Output format is the same: score, breakdown, feedback.

**Output:** `FormResult = { feedback: string[], isGoodForm: boolean, score: number, breakdown: FormBreakdown[] }`. `isGoodForm` is derived from score (e.g., score ≥ 70). The same score is used later for posture-based rep penalty.

---

## 5. Rep Phase Detection and Rep Counting

Rep counting is driven by a **finite-state machine (FSM)** over a small set of phases: `idle | eccentric | bottom | concentric | top`. A full rep is recognized when the FSM transitions in order: (idle or eccentric) → bottom → concentric → top. The logic is implemented in `form-analysis.ts` (`getRepPhase`) and is exercise-specific.

**Exercise-specific phase rules (conceptually):**

- **Squat:** Knee angle (hip–knee–ankle) drives the phase: “bottom” when knee angle below a threshold (e.g., &lt; 110°), “top” when above another (e.g., &gt; 145°), with “eccentric” and “concentric” for the descending and ascending segments.
- **Push-up:** Wrist–shoulder vertical distance (depth) is used: bottom when depth is large (chest low), top when depth is small (arms extended).
- **Lunge, bicep curl, shoulder press, jumping jacks, high knees, crunch:** Each has its own geometric or positional rules (angles, spread, curl) mapped to the same five phases.

**Hysteresis and stability:** To avoid spurious phase flips from noise, the raw phase is not used directly. A short history of raw phases is kept; the reported phase changes only when the new phase appears consistently (e.g., 3 or 5 consecutive frames). This is a form of temporal hysteresis that reduces false rep counts.

**Rep-count logic (in the UI/coach layer):** When the FSM reaches `top` from `concentric`, and a minimum time has been spent in `bottom` and a cooldown since the last rep has elapsed, one rep is committed. The **posture penalty** is applied here: the average form score over that rep is computed; if it is below a threshold (e.g., 70), the rep count is **decremented** by one instead of incremented. Otherwise the rep count is incremented. Only one user is tracked (`numPoses: 1`), so the count is per single pose in view.

---

## 6. Face Verification (One Account, One Face)

To ensure only the account owner’s reps are counted, the app supports optional **face enrollment** and **verification** using the same 33 landmarks (no separate face model).

**Face signature:** The “face” subset is landmarks 0–10 (nose, eyes, ears, mouth). A **signature** is a fixed-size vector built from these points: (1) require a minimum number of visible face landmarks (e.g., 4). (2) Normalize by centering on the nose (index 0) and scaling by a proxy for face size (e.g., inter-eye distance). (3) Output a flattened vector of normalized (x, y, z) for each of the 11 points. This gives a scale- and position-invariant descriptor.

**Enrollment:** The user triggers “Enroll your face” from the AI Coach setup. The app captures one or more frames where the face is well visible, builds the signature, and stores it in **IndexedDB** keyed by the Supabase user ID. No face data is sent to the server.

**Verification:** On each frame during a session, the same signature is computed from the current pose. **Similarity** is computed as the cosine similarity between the current signature and the stored one. If similarity is above a threshold (e.g., 0.92), the frame is considered “face match.” If no enrollment exists, verification is skipped and reps can count for any user. If enrolled and the match fails, reps are not counted and a message like “Face not recognized” is shown.

**CK-style filter:** In addition, a “CK filter” requires that at least a minimum number of face landmarks (e.g., 5) have visibility above a threshold. This ensures the face is sufficiently visible before trusting the signature or counting a rep, reducing false accepts when the face is occluded or turned away.

---

## 7. Center Check

Reps are only counted when the user is roughly **centered** in the camera frame. This avoids counting when the user is at the edge or partially out of frame, where pose and form are less reliable.

**Implementation:** Body center is defined in normalized coordinates as the midpoint between (1) nose (landmark 0) and (2) hip center `( (left_hip + right_hip) / 2 )`, i.e. `cx = (nose.x + hipCenter.x) / 2`, `cy = (nose.y + hipCenter.y) / 2`. The margins (e.g., 0.28 and 0.25) define the central band: `cx ∈ [0.28, 0.72]`, `cy ∈ [0.25, 0.75]`. If both hold, `isInCenter` returns true. The same margins are used to draw an on-screen “center zone” rectangle so the user can align themselves.

---

## 8. Integration of Checks for Rep Counting

A rep is **counted** only when all of the following hold (in addition to the FSM and timing rules):

- **Center:** `isInCenter(landmarks)` is true.
- **Face (if enrolled):** Stored signature exists and `faceMatches(current_landmarks, stored_signature)` is true.
- **CK filter:** `passesCKFaceFilter(landmarks)` is true (enough face landmarks visible).
- Optional: minimum number of body landmarks visible (e.g., ≥ 18) to ensure a reliable pose.

If any of these fail, the UI can show guidance (“Move to center,” “Face the camera,” “Face not recognized”) and the rep is not registered. When a rep is registered, the posture penalty (decrement by one if average form score &lt; threshold) is applied as described above.

---

## 9. Backend and Data Model (Supabase)

**Authentication:** Supabase Auth handles sign-up/sign-in (email–password, optional OAuth). The client uses the Supabase JS client; session and lock contention (e.g., Navigator LockManager) are mitigated with retries and backoff when accessing auth (e.g., `getUser`) from multiple concurrent calls.

**Database (PostgreSQL):** Main tables include **profiles** (user id, name, level, goals, streak, etc.), **workouts**, **runs**, **coach_sessions** (exercise name, reps, score, rep_scores array, timestamps), and **favorites**. Row-level security (RLS) ensures each user can only read/write their own rows (e.g., `auth.uid() = user_id`).

**Coach session row:** Stores the outcome of an AI Coach session: exercise name, total reps, overall form score, and an array of per-rep form scores. This supports analytics (e.g., rep quality over time) and dashboard stats. Streak and “last active” are derived or updated from profiles and activity tables.

**Client API:** The app uses a single Supabase client instance. Data access is encapsulated in a store layer (e.g., `store-supabase.ts`) that exposes functions like `getProfile`, `saveProfile`, `getWorkouts`, `getRuns`, `getCoachSessions`, `addCoachSession`, `getStreak`, `refreshStreak`, etc. Critical paths that call `getUser()` wrap the call in retry-with-backoff to handle auth lock timeouts.

---

## 10. Summary in One Paragraph

FitTrackGo is a Next.js web app that uses the MediaPipe Pose Landmarker (WASM) in the browser to obtain 33 body landmarks per frame from the user’s camera. Those landmarks are smoothed and passed into exercise-specific form analysis (joint angles and geometric rules) to produce a form score and feedback, and into a per-exercise rep-phase FSM with hysteresis to detect rep completion. Optional face verification (signature from pose face landmarks, stored in IndexedDB and matched by cosine similarity) plus a center-of-frame check and a CK-style face-visibility filter gate whether a rep is counted; when counted, a posture penalty can decrement the rep if the average form score for that rep is below a threshold. Session results (reps, score, rep_scores) are persisted to Supabase with RLS, while pose and video stay on the client. The stack is TypeScript/React/Next.js on the front end and Supabase (Auth + PostgreSQL) on the backend, with no server-side pose or face processing.
