# Body Detection — How Advanced Can We Go?

FitTrackGo uses **MediaPipe Pose Landmarker** (browser-based, no server needed). Here’s what we have today and what’s possible.

## What We Have Now

- **33 body landmarks** in real time: face (nose, eyes, ears, mouth), shoulders, elbows, wrists, fingers (pinky, index, thumb), hips, knees, ankles, heels, foot tips.
- **Full skeleton overlay**: colored segments (torso, arms, legs, face) and keypoints drawn on the camera feed.
- **Form analysis** per exercise: angles (knee, elbow, back, etc.), alignment, depth, symmetry.
- **Rep counting** with phase detection (eccentric → bottom → concentric → top) and cooldown to avoid double counts.
- **Exercises supported**: Squats, Push-ups, Plank, Lunges, Bicep Curls, Shoulder Press, Jumping Jacks, High Knees, Crunches.

## How Advanced Can We Go?

### With Current Stack (MediaPipe in the Browser)

1. **More exercises**  
   Add any exercise that can be expressed as joint angles and positions (e.g. deadlift, row, lateral raise, burpees). Each needs:
   - Angle/position rules in `form-analysis.ts`
   - Rep phase logic in `getRepPhase`
   - Tips in `EXERCISE_TIPS`

2. **Richer form cues**  
   - Use more landmarks (e.g. wrist vs shoulder for elbow flare).
   - Add “world” 3D landmarks (MediaPipe provides them) for depth and lean.
   - Per-limb symmetry, spine angle, hip rotation.

3. **Better robustness**  
   - Tune confidence thresholds and smoothing.
   - Optional calibration (e.g. “stand in T-pose”) to adapt to camera angle and distance.
   - Fallback when pose is lost (e.g. “Step back into frame”).

4. **UX improvements**  
   - On-screen “Pose: detected / not detected”.
   - Optional sound/haptic on rep.
   - Per-rep form score history and simple analytics.

### If We Add a Backend / Heavier Models

5. **Custom or fine-tuned models**  
   Train or fine-tune on fitness-specific data for better accuracy on odd angles or heavy occlusion (e.g. weights in front of body).

6. **Multi-person**  
   MediaPipe can support multiple poses; we could track several people (e.g. partner workouts) or “person of interest” selection.

7. **Temporal patterns**  
   Use sequences of poses (e.g. LSTM or small transformer) to classify full movement quality or detect specific mistakes.

## Summary

With the **current browser + MediaPipe setup**, we can already go quite far: many more exercises, finer form feedback, and better UX. Going **beyond that** (custom models, multi-person, deep temporal analysis) would mean adding a backend and/or heavier ML pipelines.
