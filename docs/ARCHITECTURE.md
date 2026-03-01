# FitTrack Go — Architecture

High-level architecture for the FitTrack Go app (Next.js, Supabase, MediaPipe, Capacitor).

---

## System overview

```mermaid
flowchart TB
  subgraph clients["Clients"]
    WEB["Web (Browser)"]
    ANDROID["Android (Capacitor)"]
  end

  subgraph app["Next.js 16 App"]
    PAGES["App Router\n(page.tsx, login, privacy, terms)"]
    API["API Routes\n(delete-account, auth/callback)"]
    MW["Middleware\n(session refresh)"]
  end

  subgraph ui["UI Layer"]
    DASH["Dashboard"]
    RUN["Run Tracker"]
    LIB["Exercise Library"]
    COACH["AI Coach"]
    PROFILE["Profile"]
    HISTORY["Workout History"]
  end

  subgraph lib["Lib / Services"]
    STORE["store-supabase\n(profiles, runs, workouts, coach)"]
    POSE["pose-detection\n(MediaPipe)"]
    FORM["form-analysis"]
    FACE["face-verification"]
    FALL["fall-detection"]
    SPEECH["speech"]
    NET["network-status\n(offline queue)"]
  end

  subgraph external["External"]
    SUPABASE["Supabase\n(Auth + Postgres)"]
    MEDIAPIPE["MediaPipe\n(Pose Landmarker)"]
    GEO["Geolocation API"]
    LEAFLET["Leaflet (maps)"]
  end

  WEB --> PAGES
  ANDROID --> PAGES
  PAGES --> MW
  PAGES --> API
  PAGES --> DASH
  PAGES --> RUN
  PAGES --> LIB
  PAGES --> COACH
  PAGES --> PROFILE
  PAGES --> HISTORY

  DASH --> STORE
  RUN --> STORE
  RUN --> GEO
  RUN --> LEAFLET
  LIB --> STORE
  COACH --> STORE
  COACH --> POSE
  COACH --> FORM
  COACH --> FACE
  COACH --> FALL
  COACH --> SPEECH
  PROFILE --> STORE
  HISTORY --> STORE

  STORE --> SUPABASE
  STORE --> NET
  POSE --> MEDIAPIPE
  API --> SUPABASE
  MW --> SUPABASE
```

---

## Data flow

```mermaid
flowchart LR
  subgraph client_side["Client"]
    A[Components]
    B[lib/store-supabase]
    C[Supabase JS Client]
  end

  subgraph server_side["Server"]
    D[API Routes]
    E[Auth Callback]
    F[Supabase Server/Admin]
  end

  subgraph supabase["Supabase"]
    G[Auth]
    H[Postgres]
  end

  A --> B
  B --> C
  C --> G
  C --> H
  D --> F
  E --> F
  F --> G
  F --> H
```

---

## Auth flow

```mermaid
sequenceDiagram
  participant User
  participant App as Next.js App
  participant MW as Middleware
  participant Supabase as Supabase Auth

  User->>App: Visit / or /login
  App->>MW: Request
  MW->>Supabase: getUser() (refresh session)
  Supabase-->>MW: Session / null
  MW-->>App: Response + cookies
  App->>App: Check auth state (page.tsx)
  alt Signed in
    App->>User: Main app (tabs)
  else Signed out
    App->>User: LoginScreen
  end

  User->>App: Sign in (email or OAuth)
  App->>Supabase: signInWithPassword / signInWithOAuth
  Supabase-->>App: Session
  App->>User: Redirect / show app
```

---

## Main features and dependencies

| Feature | Components | Lib / APIs | Data (Supabase) |
|--------|------------|------------|------------------|
| **Dashboard** | `Dashboard`, `BottomNav` | `store-supabase` (streak, stats) | profiles, runs, workouts, coach_sessions |
| **Run tracker** | `RunTracker`, `RunMap` | `store-supabase` (`addRun`), Geolocation, Leaflet | runs |
| **Exercise library** | `ExerciseLibrary` | `store-supabase` (workouts), `data/exercises.json` | workouts |
| **AI Coach** | `AICoach`, `FaceEnrollCapture` | `pose-detection`, `form-analysis`, `face-verification`, `fall-detection`, `speech`, `alarm-sound`, `center-check`, `store-supabase` | coach_sessions |
| **Profile** | `ProfileScreen` | `store-supabase`, Supabase Auth | profiles, delete-account API |
| **History** | `WorkoutHistory` | `store-supabase` (`getWorkouts`, `getRuns`, `getCoachSessions`) | workouts, runs, coach_sessions |

---

## Tech stack summary

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind, Radix UI |
| **Auth & DB** | Supabase (Auth: email/password + OAuth, Postgres) |
| **Pose / form** | MediaPipe Pose Landmarker (browser), custom form-analysis |
| **Maps** | Leaflet |
| **Mobile** | Capacitor (Android), static export to `out/` |
| **Network** | Offline queue in `network-status.ts` for failed writes |

---

## Directory layout (relevant)

```
app/                 # Routes & entry
  page.tsx           # Main SPA (splash → login → app with tabs)
  layout.tsx
  auth/callback/     # OAuth callback
  api/delete-account/
components/          # UI (dashboard, run-tracker, ai-coach, profile, …)
lib/                 # Core logic
  store-supabase.ts  # All Supabase read/write (profiles, runs, workouts, coach)
  pose-detection.ts  # MediaPipe wrapper
  form-analysis.ts   # Rep counting & form scoring
  face-verification.ts
  fall-detection.ts
  speech.ts
  network-status.ts
  supabase/          # client, server, middleware
data/                # Static (exercises.json, achievements, faq)
android/             # Capacitor Android project (webDir: out)
```

---

## Rendering the diagrams

- **In Cursor / VS Code:** Use a Mermaid preview extension.
- **On GitHub:** Paste the `mermaid` blocks into a `.md` file; GitHub renders them.
- **Online:** Copy the contents of a `mermaid` block into [mermaid.live](https://mermaid.live) to export as PNG/SVG.
