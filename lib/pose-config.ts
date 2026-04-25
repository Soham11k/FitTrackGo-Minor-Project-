/**
 * Shared configuration for pose detection, form analysis, and rep counting.
 * Single source of truth for all visibility thresholds and detection parameters.
 */

// ---------------------------------------------------------------------------
// Visibility thresholds (0–1 scale, MediaPipe confidence)
// ---------------------------------------------------------------------------

/** Minimum visibility for a landmark to be considered "detected" in body region scans */
export const VIS_REGION_SCAN = 0.35

/** Minimum visibility to trigger landmark interpolation from neighbors */
export const VIS_INTERPOLATION_TRIGGER = 0.3

/** Minimum visibility for a landmark to be drawn as a skeleton joint */
export const VIS_DRAW_JOINT = 0.15

/** Minimum visibility for a skeleton bone segment to be drawn */
export const VIS_DRAW_SEGMENT = 0.2

/** Minimum average visibility across required landmarks for form analysis */
export const VIS_FORM_ANALYSIS = 0.35

/** Minimum visibility for an individual landmark to count toward rep tracking */
export const VIS_REP_TRACKING = 0.42

/** Minimum visibility for a landmark to count as "visible" in exercise gating */
export const VIS_EXERCISE_GATE = 0.42

// ---------------------------------------------------------------------------
// 1-Euro filter parameters (adaptive jitter reduction)
// ---------------------------------------------------------------------------

/** Minimum cutoff frequency — lower = more smoothing at rest */
export const ONE_EURO_MIN_CUTOFF = 1.0

/** Speed coefficient — higher = less lag during fast movement */
export const ONE_EURO_BETA = 0.007

/** Cutoff frequency for derivative smoothing */
export const ONE_EURO_D_CUTOFF = 1.0

// ---------------------------------------------------------------------------
// Detection confidence (MediaPipe PoseLandmarker options)
// ---------------------------------------------------------------------------

/** Initial pose detection confidence (lenient for pickup) */
export const INITIAL_DETECTION_CONFIDENCE = 0.45

/** Tightened detection confidence once pose is being tracked */
export const TRACKED_DETECTION_CONFIDENCE = 0.6

/** Pose presence confidence threshold */
export const POSE_PRESENCE_CONFIDENCE = 0.5

/** Tracking confidence between frames */
export const TRACKING_CONFIDENCE = 0.5

/** Number of consecutive good frames before tightening detection confidence */
export const CONFIDENCE_TIGHTEN_AFTER_FRAMES = 15

// ---------------------------------------------------------------------------
// Camera & environment guidance thresholds
// ---------------------------------------------------------------------------

/** Minimum body coverage % to consider the user at a good distance */
export const MIN_COVERAGE_PERCENT = 30

/** Maximum body coverage % (user too close) */
export const MAX_COVERAGE_PERCENT = 95

/** Minimum FPS before warning the user about performance */
export const MIN_ACCEPTABLE_FPS = 15

/** FPS measurement window (number of frames to average over) */
export const FPS_WINDOW_SIZE = 30

// ---------------------------------------------------------------------------
// Exercise camera angle thresholds
// ---------------------------------------------------------------------------

/** Shoulder width ratio threshold: below this = side view, above = front view */
export const SIDE_VIEW_SHOULDER_RATIO = 0.06

/** Shoulder width ratio threshold: above this = front view */
export const FRONT_VIEW_SHOULDER_RATIO = 0.12

/** Recommended camera angles per exercise */
export const RECOMMENDED_CAMERA_ANGLE: Record<string, "front" | "side" | "either"> = {
  squat: "front",
  pushup: "side",
  plank: "side",
  lunge: "either",
  bicep_curl: "front",
  shoulder_press: "front",
  jumping_jacks: "front",
  high_knees: "front",
  crunch: "side",
}
