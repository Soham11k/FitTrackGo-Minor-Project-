# Full-Body Detection: How Detailed Can We Scan the Whole Body?

## What We Use: MediaPipe Pose Landmarker (33 Points)

The app uses **MediaPipe’s Pose Landmarker** in the browser. It outputs **33 body landmarks** per frame:

| Index | Landmark        | Region  |
|-------|-----------------|--------|
| 0     | nose            | Face   |
| 1–6   | eyes (L/R inner, L/R, L/R outer) | Face |
| 7–8   | left_ear, right_ear | Face |
| 9–10  | mouth_left, mouth_right | Face |
| 11–12 | left_shoulder, right_shoulder | Torso |
| 13–14 | left_elbow, right_elbow | Arms |
| 15–16 | left_wrist, right_wrist | Arms |
| 17–22 | left/right pinky, index, thumb | Hands |
| 23–24 | left_hip, right_hip | Torso |
| 25–26 | left_knee, right_knee | Legs |
| 27–28 | left_ankle, right_ankle | Legs |
| 29–30 | left_heel, right_heel | Feet |
| 31–32 | left_foot_index, right_foot_index | Feet |

So we can scan:

- **Face**: nose, eyes, ears, mouth (11 points)
- **Torso**: shoulders + hips (4 points), plus spine implied by connections
- **Arms**: shoulder → elbow → wrist → fingers (10 points per side in connections)
- **Legs**: hip → knee → ankle → heel → foot tip (5 points per side)

**How detailed we can go:** We are limited to these **33 points** and the **connections** we draw between them. We cannot add more “joints” than MediaPipe gives; we can only use them better (e.g. more segments, body-region logic, 3D).

---

## What We Do With It (Current Level of Detail)

1. **Skeleton overlay**
   - All 33 points drawn as circles (main joints larger).
   - Segments: face, **neck** (nose → shoulders), torso, left/right arm (including hand), left/right leg (including foot).
   - Color by region: blue torso, purple face/neck, yellow arms, green legs.

2. **Body scan**
   - `getBodyScanDetail(landmarks)`:
     - Decides which **regions** are visible: face, torso, left arm, right arm, left leg, right leg.
     - Counts **visible points** (out of 33).
     - Computes a **coverage %** and a short **summary** (e.g. “face, torso, arms, legs”).
   - Shown in the AI Coach as “Body scan: …” when a pose is detected.

3. **Form analysis**
   - Uses the same 33 points to compute angles (e.g. knee, elbow, back) and alignment for each exercise.

4. **World (3D) landmarks**
   - MediaPipe also returns `worldLandmarks` (x, y, z in a real-world-like space). We already pass them through; they can be used later for:
     - Depth / lean (e.g. “lean forward/back”).
     - Better left/right and orientation.

So **full-body scanning** today = **all 33 points + 6 body regions + coverage %**, plus skeleton and form logic on top.

---

## What Can Be Improved (Within the Same 33 Points)

- **Neck**
  - Already added: nose → shoulders so the neck is part of the skeleton.

- **Body scan in UI**
  - Already added: “Body scan: face, torso, arms, legs” (or partial) so the user sees how much of the body is detected.

- **Use of world (3D) landmarks**
  - Add simple depth/lean metrics (e.g. “torso lean forward/back”) using `worldLandmarks` for form hints.

- **Stability**
  - Keep/improve smoothing and confidence thresholds so the 33 points are stable frame-to-frame.

- **Hands/feet**
  - We already draw hand and foot segments; form logic could add finger spread or foot angle where useful.

- **Per-region visibility**
  - Expose “left leg weak” / “arms fully visible” in the body-scan summary or as short tips.

---

## What Would Need More Than MediaPipe

- **More than 33 points**  
  Would require a different model (e.g. custom trained or another library), not just configuration.

- **Mesh / full 3D body**  
  MediaPipe gives points only; a body mesh would need another solution (e.g. body mesh APIs or different models).

- **Multiple people**  
  We use `numPoses: 1`. Multiple people would need a different mode and UI.

So: **we can’t add more “bones” than the 33 points**, but we can use them in more detailed and user-visible ways (skeleton, body scan, coverage %, 3D-based cues, and better form logic). The current setup is already a full-body scan over those 33 points and 6 regions.
