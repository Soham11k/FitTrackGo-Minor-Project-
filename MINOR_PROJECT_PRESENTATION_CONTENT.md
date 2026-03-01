# FitTrackGo — Minor Project Presentation Content (Paragraph Form)  
**21CSP302L – MINOR PROJECT | SRM Institute of Science and Technology**

Replace [placeholders] with your details. Each slide section is in paragraph form for copy-paste into your PPT.

---

## Slide 1: Title

**Title of Project:** FitTrackGo — AI-Powered Fitness Tracking with Pose Detection and Form Analysis

**Batch ID:** [Your Batch ID]  
**Student 1 Reg. No.:** [Reg. No.] | **Student 1 Name:** [Name]  
**Student 2 Reg. No.:** [Reg. No.] | **Student 2 Name:** [Name]

**SRM INSTITUTE OF SCIENCE AND TECHNOLOGY | SCHOOL OF COMPUTING | DEPARTMENT OF COMPUTING TECHNOLOGIES | 21CSP302L - MINOR PROJECT**

**Guide name:** [Guide Name] | **Designation:** [Designation] | **Department:** [Department]

---

## Slide 2: Problem Statement

Users often do not get any real-time feedback on their exercise form when working out at home or in the gym. This leads to ineffective workouts and a higher risk of injury, because they cannot tell if they are performing movements correctly. Most existing fitness applications either ask users to log reps manually without checking form, or depend on expensive wearables, so there is a clear need for a low-cost, camera-based solution that works directly in the browser.

The background to this problem is that after the pandemic, home workouts and solo gym sessions have become more common. Without a coach or trainer, people frequently perform exercises with incorrect posture—for example, knee cave-in during squats or elbow flare during push-ups—which reduces the benefit of the exercise and can cause injury. Wearable-based form analysis is not affordable or practical for everyone, and the majority of mobile fitness apps do not use the device camera for real-time pose and form analysis.

The need for this study is to provide an accessible, web-based fitness coach that uses computer vision and pose estimation to give real-time form feedback and rep counting without any extra hardware. It is also important to ensure accountability and accuracy by linking the session to a single user through one-account-one-face verification and by penalizing incorrect posture—for example, reducing the rep count when form is poor—so that users are encouraged to maintain proper technique.

---

## Slide 3: Objectives

The first objective is to design and implement a web-based fitness application that uses real-time pose detection with the MediaPipe Pose Landmarker to track the user’s body during exercises and to provide live form analysis and rep counting for multiple exercises such as squats, push-ups, lunges, bicep curls, shoulder press, jumping jacks, high knees, crunches, and plank.

The second objective is to integrate user authentication and one-account-one-face verification so that only the enrolled user’s reps are counted, and to enforce center-of-frame and face-visibility (CK-style) filters so that body recognition is reliable and only the intended user is tracked during detection.

The third objective is to implement a posture-aware rep logic that rewards good form by counting the rep and penalizes poor form by reducing the rep by one when the average form score for that rep is below a set threshold, and to persist workout history, streaks, and statistics using a cloud backend such as Supabase so that users get a complete and continuous experience across sessions.

---

## Slide 4: Literature Review

Existing systems and research show that Google’s MediaPipe provides real-time pose estimation with 33 body landmarks in the browser and is widely used for fitness and gesture applications. Popular fitness apps such as Nike Training Club and Freeletics offer guided workouts and rep logging but generally do not provide real-time camera-based form analysis. Several research works use skeleton keypoints for rep counting and form scoring; however, most of them focus on a single exercise or on offline processing rather than a full multi-exercise, real-time web application with user verification.

Key findings from the literature indicate that browser-based pose estimation with MediaPipe is sufficient for real-time form feedback and rep counting when the user is well framed and the camera is stable. Combining pose data with a simple face signature derived from pose face landmarks allows one-account-one-user verification without needing a separate face API. In addition, temporal smoothing and hysteresis on rep phases help reduce false rep counts, and a posture-based rep penalty has been shown to encourage better form.

The research gap identified is that there are few end-to-end web applications that combine multi-exercise pose-based form analysis, face-based user verification for accountability, a posture penalty on rep count, and center-of-frame plus face-visibility (CK-style) constraints for robust recognition, all in a single deployable product. This project aims to address that gap.

---

## Slide 5: Proposed Methodology

The architecture consists of a Next.js (React) single-page application as the front end, with client-side pose detection and form logic. The application includes a Dashboard, Run Tracker, Exercise Library, AI Coach for pose-based rep counting and form feedback, Profile, and Workout History. The AI Coach pipeline works as follows: the camera feed is processed by the MediaPipe Pose Landmarker to obtain 33 landmarks per frame; these are used for form analysis (angles and alignment) and rep phase detection (eccentric, bottom, concentric, top); then face verification (if the user has enrolled), center-of-frame check, and CK-style face visibility checks are applied; finally, rep count is updated with a posture penalty and live feedback is shown. The backend uses Supabase for authentication and a PostgreSQL database, with tables for profiles, workouts, runs, coach_sessions, and favorites, and row-level security so that each user only accesses their own data. Streak and activity are derived from these stored sessions.

The tools and technologies used include Next.js 16, React 19, and TypeScript for the front end, with Tailwind CSS and Radix UI for the interface, Recharts for charts, and Leaflet for the run map. Pose and form analysis are done using the MediaPipe Pose Landmarker and custom form-analysis and rep-phase logic for each exercise. Face and center checks are implemented in custom modules: a face signature built from pose face landmarks with enrollment stored in IndexedDB, and a center check based on the body centroid. Supabase handles authentication, the database, and row-level security, and the application can be deployed on platforms such as Vercel.

The flow is that the user signs in via Supabase Auth; on the AI Coach screen they select an exercise and may optionally enroll their face before starting detection. For each frame, pose is detected and form score and rep phase are computed; if the user is centered, their face matches (when enrolled), and the CK filter passes, the rep logic runs—on rep completion, if the form score is below the threshold the rep is reduced by one, otherwise it is increased by one. Session and stats are saved to Supabase, and the dashboard and history screens read from Supabase to display the user’s data.

---

## Slide 6: Work Plan / Timeline

Phase 1 focused on the core application and pose integration. This included setting up the Next.js application with Supabase authentication, dashboard, and navigation; integrating the MediaPipe Pose Landmarker and implementing the skeleton overlay and basic form analysis for two to three exercises such as squat and push-up; and implementing rep phase detection and rep counting with cooldown and hysteresis to avoid double counts.

Phase 2 focused on user verification, posture penalty, and polish. This included adding face enrollment and one-account-one-face verification, center-of-frame and CK-style face visibility checks, and the posture-based rep penalty that reduces the rep by one when form score is below the threshold. Form analysis and rep logic were extended to all supported exercises (lunges, bicep curl, shoulder press, jumping jacks, high knees, crunch, plank). The run tracker, exercise library, and workout history were integrated, and retry and backoff logic for Supabase lock timeouts along with general error handling and UX improvements were added. Expected completion is [your target date, e.g., end of semester or March 2026].

---

## Slide 7: Expected Outcome

The product is a working web application called FitTrackGo that tracks workouts, runs, and AI Coach sessions; provides real-time pose-based form feedback and rep counting for multiple exercises; enforces one-account-one-face and center and CK constraints during recognition; and penalizes poor posture by reducing the rep count when form is below the threshold, with all data persisted in Supabase for a complete user experience.

In terms of SDG mapping, the project aligns with SDG 3 (Good Health and Well-being) by promoting physical activity and safer exercise through form feedback and injury-conscious design such as the posture penalty and form cues. It also aligns with SDG 4 (Quality Education) by acting as an accessible digital coach that helps users learn correct exercise technique without requiring a physical trainer.

For publication and patent plan, there is an option to publish a short paper or case study on the integration of pose-based form analysis with face verification and posture penalty in a web application. A patent plan can be added if the institution or team decides to pursue it.

---

## Slide 8: Conclusion

In summary, we proposed and implemented FitTrackGo, a web-based fitness application that uses MediaPipe pose estimation for real-time form analysis and rep counting across multiple exercises. The system includes one-account-one-face verification, center-of-frame and CK-style face visibility filters, and a posture penalty that reduces the rep by one when form is poor. Authentication and data are handled by Supabase, and the Next.js front end provides the dashboard, run tracking, exercise library, and AI Coach experience.

Future scope includes adding more exercises such as deadlift and rows and using finer form cues with 3D or world landmarks; exploring an optional backend model for movement quality or mistake detection using sequences of poses (e.g., LSTM or transformer); adding social features such as challenges and sharing and optional wearable integration for heart rate and calories; and improving the face model with a dedicated face embedding and supporting multi-person tracking for partner workouts.

---

## Slide 9: References

Google MediaPipe – Pose Landmarker (https://developers.google.com/mediapipe/solutions/vision/pose_landmarker). Supabase – Authentication and Database (https://supabase.com/docs). Next.js Documentation (https://nextjs.org/docs). For research on vision-based exercise recognition and form assessment, refer to recent papers on human pose estimation and activity recognition in IEEE and ACM digital libraries. For the rationale behind CK-style visibility and face-present constraints, refer to work on the Extended Cohn–Kanade (CK+) dataset and face analysis in constrained settings.

---

*Replace all [bracketed] placeholders with your actual details before adding to your slides.*
