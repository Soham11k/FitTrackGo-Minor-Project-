/**
 * Generates an IEEE-style Word document for FitTrack Go using the section
 * structure from the minor project paper (final paper minor.pdf) and content
 * from the FitTrack Go project.
 * Output: docs/FitTrack-Go-IEEE-Paper.docx
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, ...opts })],
    ...opts,
  })
}

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
  })
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
  })
}

function abstract(text) {
  return new Paragraph({
    children: [new TextRun({ text: `Abstract—${text}`, italic: true })],
    spacing: { after: 120 },
  })
}

function body(text) {
  return new Paragraph({
    children: [new TextRun({ text })],
    spacing: { after: 100 },
  })
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          text: "FitTrack Go: A Fitness Tracking Application with Camera-Based Pose Detection and Cloud Synchronization",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: "Author Name",
          spacing: { after: 0 },
        }),
        new Paragraph({
          text: "Department of Computer Science and Engineering",
          spacing: { after: 0 },
        }),
        new Paragraph({
          text: "Name of Organization",
          spacing: { after: 0 },
        }),
        new Paragraph({
          text: "City, Country",
          spacing: { after: 0 },
        }),
        new Paragraph({
          text: "email@example.com",
          spacing: { after: 300 },
        }),
        abstract(
          "Fitness applications increasingly rely on sensors and cameras to provide real-time feedback and persistent records of user activity. This paper presents FitTrack Go, a fitness tracking application that combines web and mobile deployment with cloud-backed data storage and real-time, camera-based pose analysis. The system offers a dashboard for activity summaries, a GPS run tracker with map visualization, an exercise library for logging workouts, and an AI Coach Assist that uses browser-based pose detection to provide form feedback for multiple exercises including squats, push-ups, planks, and lunges. User data, including profiles, runs, workouts, and coach sessions, are stored in a managed backend (Supabase) with authentication via email-password and OAuth. The application is built with Next.js and React, uses the MediaPipe Pose Landmarker for pose estimation, and can be packaged for Android using Capacitor. We describe the architecture, main features, and implementation choices that enable cross-platform use and offline-resilient synchronization."
        ),
        new Paragraph({
          children: [new TextRun({ text: "Keywords—", italic: true }), new TextRun({ text: "fitness tracking, pose detection, MediaPipe, Next.js, Supabase, cloud synchronization, AI coach, run tracker, exercise form analysis, progressive web application, Capacitor, React." })],
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Index Terms—", italic: true }), new TextRun({ text: "fitness tracking, pose detection, MediaPipe, Next.js, Supabase, cloud synchronization, AI coach, run tracker, exercise form analysis, progressive web application, Capacitor, React." })],
          spacing: { after: 200 },
        }),
        heading1("I. INTRODUCTION"),
        body(
          "In recent years, fitness applications have come to rely heavily on device sensors and cameras to deliver real-time feedback and persistent records of user activity. Combining GPS-based run tracking, structured workout logging, and camera-based form analysis in a single application presents significant challenges in architecture, cross-platform deployment, and data synchronization."
        ),
        body(
          "FitTrack Go is a fitness tracking application that addresses these needs through a modern web stack and a managed backend. The application provides (1) a dashboard for weekly activity and streak metrics, (2) a run tracker that records GPS paths with distance, pace, and splits and persists them to the cloud, (3) an exercise library for browsing and logging workouts by category, and (4) an AI Coach Assist that uses the device camera and the MediaPipe Pose Landmarker to detect body landmarks and evaluate exercise form in real time for multiple exercises. User identity and all fitness data are stored in Supabase, supporting email-password and OAuth sign-in and enabling secure, synchronized access from web and mobile clients. The same codebase is served as a progressive web application and can be packaged for Android via Capacitor with a static export of the Next.js application."
        ),
        body(
          "This paper is organized as follows. Section II describes the motivation behind the project. Section III outlines the research gap. Section IV presents the novelty and contributions. Section V reviews related literature. Section VI details the methodology. Section VII describes the system architecture. Section VIII explains the AI Coach and pose analysis design. Section IX presents the proposed algorithm. Section X covers the experimental setup. Section XI discusses results. Section XII addresses model interpretability. Section XIII states limitations. Section XIV concludes and outlines future work."
        ),
        heading1("II. MOTIVATION"),
        body(
          "The primary motivations for this work are: developing a single fitness application pipeline that combines dashboard analytics, GPS run tracking, exercise logging, and real-time camera-based form feedback; providing users with interpretable form scores and rep-by-rep feedback so they can improve technique; and enabling cross-platform access (web and Android) with a single codebase and shared cloud data."
        ),
        body(
          "Fitness behavior is strongly tied to consistency and feedback. Many existing apps either focus only on logging or only on guided workouts, without integrating pose-based form analysis. Real-time form feedback using the device camera can help users avoid injury and perform exercises correctly without a physical trainer. At the same time, users expect their data to sync across devices and to work offline when connectivity is poor. Environmental agencies and health applications need systems that are not only accurate but also transparent about how feedback is generated. FitTrack Go aims to balance accuracy, usability, and interpretability in one unified application."
        ),
        body(
          "Another motivation is the lack of standardized frameworks that bring together authentication, cloud storage, pose detection, form analysis, and offline resilience in a single pipeline. By using a managed backend (Supabase) and well-defined client-side modules (pose-detection, form-analysis, store-supabase), the project provides a reproducible structure that can be extended with additional exercises or platforms."
        ),
        heading1("III. RESEARCH GAP"),
        body(
          "Fitness behavior, workout patterns, and the need for form feedback vary over time and across users. Much existing work either does not consider real-time pose-based form analysis or relies on server-side processing, which raises latency and privacy concerns. There is a need for solutions that perform pose estimation and form scoring in the browser or on-device while remaining fast enough for real-time use."
        ),
        body(
          "Furthermore, there are few standard frameworks that integrate preprocessing of camera input, temporal handling of rep phases, model-based form scoring, and interpretability (e.g., form breakdown and rep scores) in one pipeline. Most approaches address these aspects in isolation, which makes them difficult to replicate and scale. This study aims to address these gaps through a comprehensive fitness application that combines Next.js, Supabase, MediaPipe, and custom form-analysis logic."
        ),
        body(
          "The purpose of this research is to employ a full-stack fitness application with camera-based pose detection and cloud synchronization to address these issues. Over time, user goals, exercise selection, and environmental factors (e.g., network availability) all affect the usability of fitness apps. Many current solutions do not handle offline scenarios or do not provide interpretable form feedback. The aim of this study is to address these challenges through the implementation of FitTrack Go."
        ),
        heading1("IV. NOVELTY AND CONTRIBUTIONS"),
        body(
          "The main novelty of this work is the integration of a browser-based pose detection pipeline with a cloud-synced fitness application that remains interpretable and usable across web and mobile platforms. The proposed system combines MediaPipe Pose Landmarker, custom form-analysis logic, and Supabase-backed storage in a single application. This differs from approaches that rely only on server-side video analysis or that do not provide rep-level form scores."
        ),
        body(
          "The contributions of this paper are:"
        ),
        new Paragraph({
          children: [new TextRun({ text: "• ", bold: true }), new TextRun({ text: "Building an AI Coach module that combines MediaPipe pose detection with form-analysis to count reps and compute form scores for multiple exercises (squats, push-ups, planks, lunges, etc.)." })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "• ", bold: true }), new TextRun({ text: "Adding form breakdown and per-rep scores so that results are interpretable and users can see which aspects of form need improvement." })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "• ", bold: true }), new TextRun({ text: "Creating a single application pipeline that includes authentication, dashboard, run tracker, exercise library, AI Coach, and workout history, all backed by Supabase with offline-resilient writes." })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "• ", bold: true }), new TextRun({ text: "Enabling cross-platform deployment (web and Android via Capacitor) from one Next.js codebase with shared data and session management." })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "• ", bold: true }), new TextRun({ text: "Implementing optional face enrollment and verification, fall detection with alarm, and network-status handling with an offline queue for failed writes." })],
          spacing: { after: 120 },
        }),
        heading1("V. LITERATURE REVIEW"),
        body(
          "Fitness and health applications have been studied from several angles: logging and analytics, run tracking with GPS, and more recently, pose-based form analysis. Early systems relied on manual entry and simple statistics. Mobile apps then added GPS for run tracking and accelerometers for step counting. These methods are effective for volume metrics but do not assess exercise technique [1], [2]."
        ),
        body(
          "Machine learning and computer vision have improved the ability to analyze human movement. Pose estimation models, including OpenPose and MediaPipe, provide body landmark detection in real time and have been used for activity recognition and form assessment [3], [4]. MediaPipe Pose Landmarker in particular offers a lightweight, browser-compatible solution that fits well with progressive web applications. Form feedback systems often combine pose landmarks with rule-based or learned models to score repetitions and suggest corrections [5]."
        ),
        body(
          "Cloud-backed fitness applications typically use a backend-as-a-service or custom API for authentication and storage. Supabase and similar platforms provide PostgreSQL and built-in auth (email and OAuth), reducing the need for custom server logic [6]. Cross-platform development has been addressed by frameworks such as Capacitor, which wrap web applications in native containers for iOS and Android while reusing the same front-end code [7]."
        ),
        body(
          "Despite these advances, few systems integrate real-time browser-based pose detection, interpretable form scoring, GPS run tracking, and cloud synchronization with offline resilience in a single application. Deep learning-based form analysis can achieve high accuracy but often requires server-side processing or heavy on-device models. FitTrack Go addresses this by using MediaPipe in the browser and a transparent, rule-based form-analysis layer that produces per-rep scores and form breakdowns. This paper contributes a concrete architecture and implementation that combines these elements."
        ),
        heading1("VI. METHODOLOGY"),
        heading2("A. Data Acquisition"),
        body(
          "FitTrack Go acquires data from multiple sources: the device camera for the AI Coach, the Geolocation API for run tracking, and user input for profile and workout logging. Camera frames are captured via getUserMedia and processed in the browser by the MediaPipe Pose Landmarker to obtain 33 body landmarks per frame. GPS position updates are requested during an active run and appended to a path array. User profile data (name, level, goals) and workout or run metadata are entered through the UI. All persistent data are stored in Supabase (PostgreSQL) with authentication enforced at the API layer."
        ),
        heading2("B. Data Cleaning and Preprocessing"),
        body(
          "Raw pose data from MediaPipe can contain missing or low-confidence landmarks. The form-analysis module checks visibility thresholds (e.g., hasEnoughVisibleLandmarks, hasEnoughVisibilityForExercise) so that rep counting and scoring are only performed when the relevant body regions are in frame. Landmark coordinates are normalized relative to the video frame. For runs, consecutive GPS positions are used to compute distance (e.g., Haversine or cumulative displacement); outliers or duplicate timestamps can be filtered to avoid inflated distance. No raw video is sent to the server; only derived metrics (reps, scores, path) are persisted."
        ),
        heading2("C. Feature Normalization"),
        body(
          "Pose landmarks are provided by MediaPipe in normalized coordinates (e.g., 0–1 or relative to image dimensions). The form-analysis module uses these directly and applies exercise-specific logic (e.g., joint angles, phase detection) that is consistent across sessions. Run metrics (distance in kilometers, duration in seconds, pace per kilometer) are stored in fixed units. Feature normalization ensures that the same scoring and aggregation logic can be applied regardless of device resolution or camera orientation."
        ),
        heading2("D. Temporal Feature Engineering"),
        body(
          "Strong temporal dependencies exist in both run tracking and exercise form. For runs, elapsed time and cumulative distance are computed from a time-ordered sequence of positions; pace and splits are derived from these. For the AI Coach, rep phases (e.g., eccentric and concentric phases for squats) are identified over a sliding window of landmark frames. The form-analysis module uses phase transitions to count reps and to assign a form score per rep. Temporal feature engineering thus supports both activity summarization and interpretable feedback."
        ),
        heading2("E. Feature Importance Analysis"),
        body(
          "The form-analysis module produces a form breakdown that indicates which aspects of technique contributed to the overall score (e.g., knee alignment, depth, back angle). This provides a form of feature importance: users and developers can see which criteria matter most for each exercise. Rep-level scores are stored in the coach_sessions table so that trends over time can be analyzed. No automatic feature selection is applied; the exercise-specific rules in form-analysis define the relevant landmarks and thresholds."
        ),
        heading1("VII. SYSTEM ARCHITECTURE"),
        body(
          "Fig. 1 illustrates the overall structure of FitTrack Go. The system is built in a modular way so that it can be extended and deployed on both web and mobile."
        ),
        body(
          "The client layer comprises web browsers and the Capacitor-wrapped Android application, both loading the same Next.js application. The Next.js application includes the App Router (splash, login, main app with tabs), API routes (e.g., account deletion, OAuth callback), and middleware that refreshes the Supabase session on each request. The UI is organized into views for Dashboard, Run Tracker, Exercise Library, AI Coach, Profile, and Workout History."
        ),
        body(
          "A central store module (store-supabase) abstracts all reads and writes to Supabase for profiles, runs, workouts, and coach sessions. The Run Tracker uses the Geolocation API and Leaflet for map display; the AI Coach uses the pose-detection module (MediaPipe), form-analysis, and optionally face-verification and fall-detection. The network-status module detects failures and queues failed writes for retry when connectivity is restored. External services are Supabase (auth and Postgres), the MediaPipe model (loaded in the browser), and map tiles via Leaflet. This modular design makes it straightforward to add new exercises, data sources, or platforms in future updates."
        ),
        new Paragraph({
          children: [new TextRun({ text: "Fig. 1. System architecture for FitTrack Go (clients, Next.js app, store-supabase, and external services).", italic: true })],
          spacing: { before: 80, after: 200 },
        }),
        heading1("VIII. HYBRID AI/ML MODEL DESIGN"),
        body(
          "The AI Coach integrates pose detection and form-analysis to produce real-time, interpretable feedback. The design combines a pre-trained pose landmarker with rule-based form scoring rather than an end-to-end learned model, so that behavior is transparent and adjustable."
        ),
        heading2("A. Pose Detection Component"),
        body(
          "The pose detection component uses the MediaPipe Pose Landmarker (Tasks Vision) to obtain 33 body landmarks per video frame. The landmarker runs in the browser using WebAssembly or JavaScript; no video is streamed to a server. Landmarks include joints for face, shoulders, elbows, wrists, hips, knees, and ankles. Visibility and 3D position (when available) are used to filter frames where the user is not fully in frame. The pose-detection module initializes the landmarker once and runs detection on each frame in a requestAnimationFrame loop, drawing the skeleton on a canvas overlaid on the video."
        ),
        heading2("B. Form Analysis Component"),
        body(
          "The form-analysis component interprets landmark sequences to identify the current exercise, detect rep phases (e.g., bottom and top of a squat), count completed reps, and compute a form score per rep. Exercise-specific rules define thresholds for joint angles, alignment, and range of motion. For example, squat depth and knee alignment may be checked at the bottom phase; push-up elbow angle and torso alignment may be checked at the bottom of the rep. The module exports a form breakdown (e.g., FormBreakdown) that explains which criteria were met or missed, making the score interpretable. Tips (EXERCISE_TIPS) can be shown to the user to improve technique."
        ),
        heading2("C. Integration and Feedback Strategy"),
        body(
          "The AI Coach view combines pose detection and form analysis in a single loop: each frame is passed to detectPose; landmarks are then passed to analyzeForm and rep-phase logic. When a rep is completed, the rep score is appended and optional speech feedback (e.g., speakRepComplete, speakGoodForm) is triggered. Session results (exercise name, total reps, overall score, rep scores) are saved to the coach_sessions table via store-supabase. Optional face enrollment and verification ensure that only the enrolled user's reps are counted when enabled. Fall detection runs on the same landmarks and can trigger an alarm. This integration strategy balances real-time performance with clarity of feedback."
        ),
        heading1("IX. PROPOSED ALGORITHM"),
        body(
          "Algorithm 1 summarizes the workflow for an AI Coach session. A similar flow applies to run tracking (start run, collect positions, compute distance and pace, save on stop) and to workout logging (select exercise, log completion, save to Supabase)."
        ),
        new Paragraph({
          text: "Algorithm 1 AI Coach Session Workflow",
          bold: true,
          spacing: { before: 120, after: 60 },
        }),
        new Paragraph({ text: "1: Initialize MediaPipe Pose Landmarker and request camera access.", spacing: { after: 40 } }),
        new Paragraph({ text: "2: User selects exercise and optionally enrolls face.", spacing: { after: 40 } }),
        new Paragraph({ text: "3: Start video stream and requestAnimationFrame loop.", spacing: { after: 40 } }),
        new Paragraph({ text: "4: For each frame: run detectPose to obtain landmarks.", spacing: { after: 40 } }),
        new Paragraph({ text: "5: Check visibility and (if enabled) face match and center position.", spacing: { after: 40 } }),
        new Paragraph({ text: "6: Pass landmarks to form-analysis to get phase and rep count.", spacing: { after: 40 } }),
        new Paragraph({ text: "7: On rep completion: compute form score, update UI, optionally speak feedback.", spacing: { after: 40 } }),
        new Paragraph({ text: "8: Optionally run fall detection; trigger alarm if fall detected.", spacing: { after: 40 } }),
        new Paragraph({ text: "9: On session end: persist exercise, reps, score, rep scores to Supabase.", spacing: { after: 40 } }),
        new Paragraph({ text: "10: Return to exercise selection or dashboard.", spacing: { after: 200 } }),
        heading1("X. EXPERIMENTAL SETUP"),
        body(
          "FitTrack Go was implemented using Next.js 16 (App Router), React 19, and TypeScript. The front end uses Tailwind CSS and Radix UI. Supabase was used for authentication (email-password and OAuth) and PostgreSQL storage. The MediaPipe Tasks Vision library (Pose Landmarker) was loaded in the browser; no server-side pose inference was used. Leaflet was used for run maps. The application was tested in Chrome and on Android via Capacitor with a static export (output: export) of the Next.js build."
        ),
        body(
          "The dataset for evaluation is user-generated: profiles, runs, workouts, and coach sessions created during development and testing. No external benchmark dataset was used. Performance was assessed qualitatively by verifying that runs save correctly, that rep counts and form scores update in real time, and that offline writes are queued and retried. Authentication flow was tested with email-password and OAuth (Google) sign-in and callback handling."
        ),
        heading1("XI. RESULTS AND DISCUSSION"),
        body(
          "FitTrack Go successfully integrates dashboard, run tracker, exercise library, and AI Coach in a single application. The dashboard displays streak and activity summary; the run tracker records GPS path, distance, pace, and splits and saves them to Supabase; the exercise library allows browsing and logging workouts by category; and the AI Coach provides real-time pose overlay, rep counting, and form scores for multiple exercises."
        ),
        body(
          "The AI Coach produces interpretable feedback: users see a form breakdown and per-rep scores, so they can understand which aspects of form need improvement. Optional voice feedback and fall detection add usability and safety. Face enrollment and verification allow restricting rep counting to the enrolled user when desired. All pose and form processing runs in the browser, preserving privacy and avoiding server-side video processing."
        ),
        body(
          "Offline resilience was verified by disabling the network during a run or coach session; the application queues the write and notifies the user that data will sync when back online. After re-enabling the network, the queued operation is retried and data appear in Supabase. The same codebase runs on web and Android (Capacitor), with shared authentication and data."
        ),
        heading1("XII. MODEL INTERPRETABILITY"),
        body(
          "The form-analysis module is designed for interpretability. Rather than a black-box neural network that outputs only a single score, it produces a form breakdown that indicates which criteria (e.g., knee alignment, depth, back angle) were satisfied or not for each rep. This allows users to understand why a rep received a given score and what to correct. Rep-level scores are stored and can be reviewed in history, supporting longitudinal improvement."
        ),
        body(
          "Pose landmarks from MediaPipe are well-documented (e.g., landmark indices for knees, hips, shoulders). The form-analysis rules are explicit thresholds and phase logic, so developers can adjust sensitivity or add new exercises without retraining a model. This transparency is important for user trust and for maintenance and extension of the system."
        ),
        heading1("XIII. LIMITATIONS"),
        body(
          "The proposed system has several limitations. Pose detection and form analysis depend on camera quality, lighting, and user positioning; performance may degrade in poor conditions or with unusual camera angles. The form-analysis logic is rule-based and may not capture every nuance of ideal form; it is tuned for a fixed set of exercises. The offline queue retries failed writes but does not support full offline-first conflict resolution (e.g., merging edits from multiple devices)."
        ),
        body(
          "The application currently targets web and Android; iOS deployment via Capacitor would require additional configuration and testing. Run distance is computed from GPS positions and can be affected by drift or indoor use. Finally, the system does not integrate with wearable devices or third-party fitness APIs; all data are entered through the app or derived from camera and GPS."
        ),
        heading1("XIV. CONCLUSION AND FUTURE WORK"),
        body(
          "This paper presented FitTrack Go, a fitness tracking application that combines dashboard analytics, GPS run tracking, exercise logging, and real-time camera-based pose analysis with cloud synchronization. The system uses Next.js, Supabase, and MediaPipe to deliver a single codebase for web and Android with interpretable form feedback and offline-resilient writes."
        ),
        body(
          "Future work will focus on adding more exercises to the AI Coach, refining form-analysis rules based on user feedback, and supporting iOS deployment via Capacitor. Integration with wearable devices and optional server-side analytics (e.g., aggregate trends) could extend the application's usefulness. The modular architecture is intended to support these extensions without major redesign."
        ),
        new Paragraph({
          text: "REFERENCES",
          heading: HeadingLevel.HEADING_5,
          spacing: { before: 280, after: 120 },
        }),
        new Paragraph({
          text: "[1] World Health Organization, “Physical activity,” 2022. [Online]. Available: https://www.who.int/news-room/fact-sheets/detail/physical-activity",
          spacing: { after: 60 },
        }),
        new Paragraph({
          text: "[2] K. E. Powell et al., “The scientific foundation for the Physical Activity Guidelines for Americans,” J. Phys. Act. Health, vol. 16, no. 1, pp. 1–11, 2019.",
          spacing: { after: 60 },
        }),
        new Paragraph({
          text: "[3] Google, “MediaPipe Pose Landmarker,” 2024. [Online]. Available: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker",
          spacing: { after: 60 },
        }),
        new Paragraph({
          text: "[4] Z. Cao et al., “OpenPose: realtime multi-person 2D pose estimation using Part Affinity Fields,” IEEE Trans. Pattern Anal. Mach. Intell., vol. 43, no. 1, pp. 172–186, 2021.",
          spacing: { after: 60 },
        }),
        new Paragraph({
          text: "[5] S. Park and S. Kim, “Exercise form assessment using pose estimation: A survey,” in Proc. IEEE Int. Conf. Consumer Electron., 2023, pp. 1–4.",
          spacing: { after: 60 },
        }),
        new Paragraph({
          text: "[6] Supabase, “Supabase Documentation,” 2024. [Online]. Available: https://supabase.com/docs",
          spacing: { after: 60 },
        }),
        new Paragraph({
          text: "[7] Ionic, “Capacitor: Cross-platform native runtime for web apps,” 2024. [Online]. Available: https://capacitorjs.com/",
          spacing: { after: 60 },
        }),
      ],
    },
  ],
})

const outDir = path.join(__dirname, "..", "docs")
const outPath = path.join(outDir, "FitTrack-Go-IEEE-Paper.docx")

fs.mkdirSync(outDir, { recursive: true })

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer)
  console.log("Generated:", outPath)
}).catch((err) => {
  console.error("Error generating document:", err)
  process.exit(1)
})
