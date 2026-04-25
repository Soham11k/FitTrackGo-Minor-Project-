# Research-Based Minor Project — Slide Deck (FitTrack Go)

Use this outline inside your **Ctech / Minor Project PPT template**: one slide per **###** block unless noted. Replace bracketed fields with your name, roll no., guide, institution, and dates.

---

### Slide 1 — Title
**FitTrack Go: A Web-Based mHealth Platform for Activity Tracking, Form-Aware Coaching, and Wearable Integration**

Minor Project (CSE / Ctech)  
**Student:** [Your name], [Roll no.]  
**Guide:** [Name]  
**Department / Institution:** [.]  
**Academic year:** [.]

---

### Slide 2 — Abstract (summary)
- **Context:** Consumer fitness apps often split **activity logging**, **technique feedback**, and **wearable data** across separate tools.
- **Work:** **FitTrack Go** — a **Progressive Web App** (Next.js) that unifies **GPS runs**, **structured workouts**, **camera-based pose-assisted coaching** (MediaPipe), and **optional Fitbit cloud integration** (OAuth + REST) with **Supabase** as backend.
- **Outcome:** A deployable prototype demonstrating **multimodal** fitness support: **server-side wearable sync**, **client-side vision**, and **cloud persistence** with auth.

---

### Slide 3 — Problem statement (research motivation)
- Manual or fragmented tracking reduces **adherence** and **feedback quality**.
- **Form quality** in bodyweight training is hard to self-assess without a coach.
- **Wearable summaries** (e.g., resting HR, SpO₂) live in vendor silos; developers need **standardized API access** and **secure token storage**.
- **Research gap addressed:** Integrate **vision-based rep counting / form cues**, **location-based run analytics**, and **third-party wearable summaries** in one **research-grade prototype** suitable for **usability and technical evaluation**.

---

### Slide 4 — Objectives
1. Design a **modular mHealth web architecture** (client, API routes, database, external APIs).
2. Implement **real-time pose estimation** in-browser for selected exercises with **measurable rep/score outputs**.
3. Integrate **Fitbit Web API** via **OAuth 2.0**, with **token refresh** and **daily metric sync** into an application database.
4. Evaluate **feasibility** (latency, browser constraints, API limits) and document **limitations** (device coverage, intraday vs daily data).

---

### Slide 5 — Research questions (optional bullet slide)
- **RQ1:** Can **browser-based** pose landmarks provide **usable** feedback for home exercise without native apps?  
- **RQ2:** How reliably can **Fitbit’s documented REST endpoints** populate **resting HR / SpO₂ summaries** after user-authorized sync?  
- **RQ3:** What **security and privacy** patterns (Supabase RLS, service role, HTTPS) are appropriate for **storing wearable tokens**?

---

### Slide 6 — Related work & literature (condensed)
- **mHealth & fitness apps:** Widespread use of smartphones for **PA tracking**; need for **multimodal** sensing (phone + wearable) — *cite surveys on mobile health / fitness apps (e.g., JMIR, IEEE reviews — add 2–3 real papers from your library.*
- **Human pose estimation:** **MediaPipe / BlazePose** family — **landmark-based** pipelines suitable for **edge / browser** deployment; trade-offs vs heavier models — *cite MediaPipe Pose / BlazePose technical report.*
- **Wearable ecosystems:** **OAuth-protected** vendor APIs (Fitbit / Google Fit ecosystem); **sleep- and sync-dependent** SpO₂ semantics — *cite Fitbit Web API / SpO₂ documentation as grey literature.*
- **Positioning:** FitTrack Go = **PWA + BaaS (Supabase)** + **vision task** + **wearable REST** as an **integrated research prototype**.

---

### Slide 7 — Proposed methodology (system study + design)
- **Requirements analysis:** Functional (auth, runs, coach, profile, wearables) and non-functional (security, responsiveness, accessibility).
- **Architecture:** **Client-heavy** UI (React); **serverless-style** API routes (Next.js) for **secrets** and **Fitbit calls**; **Postgres** for structured data; **JWT/session** via Supabase Auth.
- **Data flow:** User → OAuth (Fitbit) → tokens stored **server-side** → scheduled / on-demand **sync** → **daily metrics** table → dashboard / history UI.
- **Vision pipeline:** Camera frames → **MediaPipe Pose Landmarker** → landmark geometry → **exercise-specific rules** (form heuristics, rep counting).

---

### Slide 8 — System architecture (diagram slide)
**Suggested diagram (draw in template):**

- **Browser:** Next.js app — Dashboard, Run (Leaflet + Geolocation), Coach (MediaPipe), Profile.  
- **API layer:** `/api/*` — wearables (status, live, sync, OAuth callback), health, optional error reporting.  
- **Supabase:** Auth, `profiles`, `runs`, `workouts`, coach sessions, `wearable_connections`, `wearable_daily_metrics`.  
- **External:** **Fitbit API** (heart, SpO₂ summaries); optional **Web Bluetooth** for **standard BLE HR** (research extension — not Fitbit-band direct).

---

### Slide 9 — Implementation — Core modules
| Module | Role |
|--------|------|
| **Authentication** | Email/OAuth via Supabase; session for API calls |
| **Run tracker** | GPS path, distance, pace, map (Leaflet), persistence |
| **Exercise library** | Categories, logging, streaks / weekly aggregates |
| **Coach Assist** | MediaPipe Tasks Vision; rep/score; optional enrollment hooks |
| **Wearables** | Fitbit OAuth, token refresh, sync (range + series endpoints), live read |
| **Internationalization / UX** | Locale, units, reduced-motion-safe UI patterns |

---

### Slide 10 — Wearable integration (research detail)
- **OAuth 2.0 authorization code** flow; **state** cookie; callback exchanges **code** for tokens.  
- **Scopes:** e.g. **heartrate**, **oxygen_saturation** (as configured in Fitbit app settings).  
- **Sync strategy:** Combine **interval SpO₂** (array response) and **multi-day heart series** to mitigate **single-day empty** responses; merge into **`wearable_daily_metrics`**.  
- **Limitation (honest):** **Intraday** HR and **SpO₂** depend on **Fitbit account processing**, **device model**, and **sleep duration** (documented by Fitbit).

---

### Slide 11 — Pose-based coaching (research detail)
- **Input:** Webcam stream; **inference** in browser (privacy: no raw video upload required for basic pipeline).  
- **Output:** Discrete **reps**, **scores**, optional **form tiers**; logged as **coach sessions** for analytics.  
- **Evaluation angle:** Qualitative **demo** + quantitative **frame rate / joint stability** (if you measured in project — else mark as **future work**).

---

### Slide 12 — Experimental setup / evaluation plan
- **Hardware:** [e.g., laptop + phone; test HR strap for Web Bluetooth if used]  
- **Software:** Node LTS, Next.js build, Chrome (Web Bluetooth / WASM), Fitbit test account  
- **Metrics (examples):**  
  - **Functional:** Successful OAuth, sync row counts, dashboard load without client errors  
  - **Performance:** API latency (live vs sync), coach FPS (informal)  
  - **Security:** Tokens not exposed to client bundle; service role only on server  

---

### Slide 13 — Results & discussion (fill with your measurements)
- **Qualitative:** End-to-end **demo**: connect Fitbit → sync → vitals on Home; coach session saved.  
- **Quantitative (placeholders):** e.g., “Sync populated **N** days of SpO₂ / resting HR in **M** trials” — **replace with your runs.**  
- **Failures / edge cases:** Empty SpO₂ when sleep &lt; threshold; **Safari** limitations for Web Bluetooth; **display:none** chart sizing (mitigated in implementation).  

---

### Slide 14 — Limitations
- **Vendor lock-in** for wearables (Fitbit-specific paths).  
- **Browser dependency** for vision and BLE; **not** a replacement for medical devices.  
- **SpO₂ / HR** are **wellness metrics**, not diagnostic (align disclaimers in app).  
- **Scalability** of token refresh and rate limits under many users not load-tested in minor project scope.

---

### Slide 15 — Future work
- Additional **wearable providers** (Garmin, Apple Health export patterns).  
- **On-device** or **edge** model compression for coach; **offline-first** sync.  
- **Formal user study** (SUS questionnaire, task completion time).  
- **Federated or privacy-preserving** aggregation for research datasets.

---

### Slide 16 — Conclusion
- Delivered an **integrated** fitness web platform combining **activity logging**, **vision-based coaching**, and **authorized wearable summaries**.  
- Demonstrated **practical research skills**: API design, OAuth, database modeling, and **human–computer interaction** considerations for health UI.  
- Establishes a **baseline** for extended **thesis / major project** work in **mHealth** or **computer vision for rehabilitation**.

---

### Slide 17 — References (APA/IEEE style — complete in your library)
1. Google AI. *MediaPipe* / Pose Landmarker documentation & model cards.  
2. Fitbit LLC. *Fitbit Web API Reference* — Heart Rate, SpO₂ endpoints (developer.fitbit.com).  
3. Supabase. *Documentation* — Auth, Postgres, Row Level Security.  
4. [Add 2–4 peer-reviewed:] mHealth adoption survey; pose estimation survey; PWA for health; security in fitness apps.

---

### Slide 18 — Q&A
**Thank you.**  
Questions?

---

## Speaker notes (short)
- Emphasize **research contribution** as **system integration + reproducible prototype**, not a new SOTA model.  
- Be ready to defend **why web** (reach, no install) vs **native** (sensors, background).  
- State clearly: **Fitbit data path = cloud**, **BLE path = optional standard HR devices**, not guessing tracker over Bluetooth.
