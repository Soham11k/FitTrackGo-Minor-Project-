# IEEE Paper Content for FitTrack Go

Copy the sections below into the IEEE Word template, replacing the placeholder text. Remove this heading and any instructions before submission.

---

## Title (use style: paper title)

FitTrack Go: A Fitness Tracking Application with Camera-Based Pose Detection and Cloud Synchronization

---

## Authors and Affiliations

Replace with your actual names and affiliations. Template expects up to six authors in two columns, e.g.:

**Column 1:**  
line 1: [1st Author Given Name Surname]  
line 2: [dept. name of organization]  
line 3: [name of organization]  
line 4: [City, Country]  
line 5: [email address or ORCID]

**Column 2:**  
line 1: [2nd Author Given Name Surname]  
line 2: [dept. name of organization]  
line 3: [name of organization]  
line 4: [City, Country]  
line 5: [email address or ORCID]

(Add or remove columns per template for your number of authors.)

---

## Abstract

This paper presents FitTrack Go, a fitness tracking application that combines web and mobile deployment with cloud-backed data storage and real-time, camera-based pose analysis. The system offers a dashboard for activity summaries, a GPS run tracker with map visualization, an exercise library for logging workouts, and an AI Coach Assist that uses browser-based pose detection to provide form feedback for multiple exercises including squats, push-ups, planks, and lunges. User data, including profiles, runs, workouts, and coach sessions, are stored in a managed backend (Supabase) with authentication via email-password and OAuth. The application is built with Next.js and React, uses the MediaPipe Pose Landmarker for pose estimation, and can be packaged for Android using Capacitor. We describe the architecture, main features, and implementation choices that enable cross-platform use and offline-resilient synchronization.

---

## Keywords

fitness tracking, pose detection, MediaPipe, Next.js, Supabase, cloud synchronization, AI coach, run tracker, exercise form analysis, progressive web application, Capacitor, React.

---

## I. INTRODUCTION

Fitness applications increasingly rely on sensors and cameras to provide real-time feedback and persistent records of user activity. Combining GPS-based run tracking, structured workout logging, and camera-based form analysis in a single application presents challenges in architecture, cross-platform deployment, and data synchronization.

FitTrack Go is a fitness tracking application that addresses these needs through a modern web stack and a managed backend. The application provides (1) a dashboard for weekly activity and streak metrics, (2) a run tracker that records GPS paths with distance, pace, and splits and persists them to the cloud, (3) an exercise library for browsing and logging workouts by category, and (4) an AI Coach Assist that uses the device camera and the MediaPipe Pose Landmarker to detect body landmarks and evaluate exercise form in real time for multiple exercises. User identity and all fitness data are stored in Supabase, supporting email-password and OAuth sign-in and enabling secure, synchronized access from web and mobile clients. The same codebase is served as a progressive web application and can be packaged for Android via Capacitor with a static export of the Next.js application.

This paper is organized as follows. Section II outlines the system architecture and technology stack. Section III describes the main features and their implementation. Section IV discusses authentication, data flow, and offline handling. Section V concludes and notes possible extensions.

---

## II. SYSTEM ARCHITECTURE

### A. Technology Stack

The client application is built with Next.js 16 (App Router), React 19, and TypeScript. The user interface uses Tailwind CSS and Radix UI components. The backend is Supabase, which provides PostgreSQL storage and built-in authentication (email-password and OAuth providers such as Google and Apple). Run maps are rendered with Leaflet. Pose estimation is performed in the browser using the MediaPipe Tasks Vision library (Pose Landmarker). For mobile deployment, the web application is statically exported and wrapped with Capacitor to produce an Android build.

### B. High-Level Architecture

The system has three main layers: clients, the Next.js application, and external services. Clients include web browsers and the Capacitor-wrapped Android application, both consuming the same Next.js application. The Next.js application comprises the App Router (single-page flow for splash, login, and main app with tabs), API routes (for example, account deletion and OAuth callback), and middleware that refreshes the Supabase session on each request. The UI is organized into views for Dashboard, Run Tracker, Exercise Library, AI Coach, Profile, and Workout History. A central store module (store-supabase) abstracts all reads and writes to Supabase for profiles, runs, workouts, and coach sessions. The AI Coach additionally depends on pose-detection (MediaPipe), form-analysis (rep counting and form scoring), face-verification and fall-detection modules, speech output, and an offline-capable network-status layer that queues failed writes for later sync. External services are Supabase (auth and Postgres), the MediaPipe model (loaded in the browser), the Geolocation API for runs, and Leaflet for map tiles.

### C. Data Model

User data are stored in Supabase tables: profiles (name, level, goals, onboarding state), runs (distance, duration, pace, calories, GPS path, completion time), workouts (title, category, duration, calories, exercise count, completion time), and coach_sessions (exercise name, reps, form score, per-rep scores, completion time). The client uses a singleton Supabase browser client for all data operations; API routes and the auth callback use server-side Supabase clients for secure and administrative actions.

---

## III. MAIN FEATURES AND IMPLEMENTATION

### A. Dashboard and Navigation

After authentication, the user sees a dashboard with a streak indicator, weekly activity summary, and quick actions that navigate to Run Tracker, Exercise Library, AI Coach, or Workout History. A bottom navigation bar switches between Home, Run, Exercises, AI Coach, and Profile. The Workout History view aggregates runs, logged workouts, and AI Coach sessions from Supabase and displays them in a single chronological list.

### B. Run Tracker

The run tracker uses the browser or device Geolocation API to obtain position updates during a run. Positions are appended to a path array and rendered on a Leaflet map. Elapsed time, distance (computed from consecutive positions), pace, and estimated calories are shown in real time. The user can pause and resume; on stop, the run is saved via the store-supabase module to the Supabase runs table. If the network is unavailable, the write is queued and retried when connectivity is restored.

### C. Exercise Library

The exercise library presents workouts by category using static data (e.g., exercises.json). The user can browse exercises and log completed sessions; logged workouts are stored in Supabase and appear on the dashboard and in Workout History. The library also provides navigation to the AI Coach for form-guided practice.

### D. AI Coach Assist

The AI Coach is the most complex feature. It uses the device camera and MediaPipe Pose Landmarker to obtain 33 body landmarks per frame. A form-analysis module interprets these landmarks to identify exercise type, count reps, and compute a form score. Supported exercises include squats, push-ups, planks, lunges, and others; the system provides real-time feedback and optional voice cues. Optional face enrollment and verification restrict rep counting to the enrolled user. Fall detection can trigger an alarm for safety. Session results (exercise, reps, score, rep scores) are saved to the coach_sessions table in Supabase. All pose and form processing runs in the browser; no video is sent to the server.

### E. Profile and Account

The profile screen displays user name, level, goals, and settings. Account deletion is performed via an API route that uses a server-side Supabase client and, where required, an admin client to remove user data and then delete the auth user.

---

## IV. AUTHENTICATION, DATA FLOW, AND OFFLINE BEHAVIOR

### A. Authentication

Supabase Auth handles sign-up and sign-in with email and password; OAuth providers (e.g., Google, Apple) are supported via redirect to Supabase and a callback route that exchanges the code for a session. Next.js middleware runs on each request and calls Supabase to refresh the session and update cookies. The client checks auth state on load and subscribes to auth state changes to switch between login and main app views.

### B. Data Flow

UI components call functions in store-supabase (e.g., getStreak, addRun, getWorkouts, addCoachSession). The store uses the singleton Supabase browser client to perform selects, inserts, and updates against the Supabase Postgres database. API routes and the auth callback use server-side Supabase clients so that sensitive operations (e.g., account deletion) do not rely solely on client-side tokens.

### C. Offline and Network Resilience

The network-status module detects failures (e.g., failed fetch). When a Supabase write fails due to network error, the store can queue the operation for retry. The user is notified that data will sync when back online, and the UI remains consistent with local expectations where possible.

---

## V. CONCLUSION

FitTrack Go demonstrates a full-stack fitness application that integrates GPS run tracking, workout logging, and camera-based pose analysis with a single cloud backend. The use of Next.js, Supabase, and MediaPipe allows a single codebase to serve web and Android users with shared authentication and data. Future work may include additional exercises in the AI Coach, richer analytics on the dashboard, and iOS deployment via Capacitor.

---

## ACKNOWLEDGMENT

(Add acknowledgments here. If none, delete this section or replace with “This work received no specific funding.”)

---

## REFERENCES

[1] Supabase, “Supabase Documentation,” 2024. [Online]. Available: https://supabase.com/docs

[2] Google, “MediaPipe Pose Landmarker,” 2024. [Online]. Available: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker

[3] Vercel, “Next.js Documentation,” 2024. [Online]. Available: https://nextjs.org/docs

[4] Ionic, “Capacitor: Cross-platform native runtime for web apps,” 2024. [Online]. Available: https://capacitorjs.com/

[5] Leaflet, “Leaflet — an open-source JavaScript library for mobile-friendly interactive maps,” 2024. [Online]. Available: https://leafletjs.com/

[6] React, “React — A JavaScript library for building user interfaces,” 2024. [Online]. Available: https://react.dev/

(Replace with your actual references; add journal or conference citations as required by your venue.)

---

## Notes for Dropping Into the IEEE Word Template

1. **Title:** Use the exact title above in the template “paper title” style; do not use sub-titles in the title field for Xplore.
2. **Abstract:** Do not use symbols, special characters, footnotes, or math in the title or abstract.
3. **Keywords:** Replace or extend the keyword list to match your conference’s requirements.
4. **Headings:** Use Heading 1 for Roman-numeral sections (I, II, III, …), Heading 2 for A, B, C, and so on.
5. **Figures and tables:** Insert figures (e.g., architecture diagram exported from ARCHITECTURE.md or Mermaid) and tables after they are first cited in the text; use “Fig. 1” and “TABLE I” as in the template.
6. **References:** Format per the template and your conference’s reference style; the list above is a placeholder.
7. Remove all template guidance text and this “Notes” section before submission.
