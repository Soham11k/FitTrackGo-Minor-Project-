/**
 * AI Coach exercise families and variants (two-step picker).
 * Each variant maps 1:1 to a FormSpec id in lib/form-engine/registry.
 */

import { hasSpec, loadSpec } from "@/lib/form-engine/registry"

export type CoachFamilyCategory = "upper" | "lower" | "core" | "cardio" | "compound"

/** Lucide icon name — resolved in components/ai-coach.tsx */
export type CoachFamilyIconKey =
  | "Activity"
  | "Dumbbell"
  | "Shield"
  | "Flame"
  | "Weight"
  | "BicepsFlexed"
  | "CircleDot"
  | "Move"
  | "Footprints"
  | "LayoutList"
  | "GripVertical"

export interface CoachVariantDef {
  specId: string
  /** Short label (may match FormSpec.displayName) */
  name: string
  description: string
  cameraNote?: string
  /** Optional tips; merged before family fallback */
  tips?: string[]
}

export interface CoachFamilyDef {
  id: string
  name: string
  description: string
  category: CoachFamilyCategory
  iconKey: CoachFamilyIconKey
  gradient: string
  variants: CoachVariantDef[]
  /**
   * Legacy EXERCISE_TIPS / cultural-tips key when variant has no tips.
   */
  tipsKey:
    | "squat"
    | "pushup"
    | "plank"
    | "lunge"
    | "deadlift"
    | "rdl"
    | "bicep_curl"
    | "shoulder_press"
    | "jumping_jacks"
    | "high_knees"
    | "crunch"
}

export const COACH_EXERCISE_FAMILIES: CoachFamilyDef[] = [
  {
    id: "pushup_family",
    name: "Push-up",
    description: "Chest and triceps — pick your hand position",
    category: "upper",
    iconKey: "Activity",
    gradient: "from-destructive/20 to-chart-2/20",
    tipsKey: "pushup",
    variants: [
      { specId: "pushup", name: "Standard", description: "Hands about shoulder-width, elbows ~45°.", cameraNote: "Side view works best." },
      {
        specId: "pushup_wide",
        name: "Wide",
        description: "Hands wider than shoulders; flare is OK.",
        cameraNote: "Side or 45° so we see elbow path.",
      },
      {
        specId: "pushup_diamond",
        name: "Diamond",
        description: "Hands close, triangle under chest.",
        cameraNote: "Side view to judge depth and elbow path.",
      },
      {
        specId: "pushup_knee",
        name: "Knee",
        description: "Shorter lever — knees down, straight line knees–shoulders.",
        cameraNote: "Side view; hips to shoulders in one line.",
      },
      {
        specId: "pushup_incline",
        name: "Incline",
        description: "Hands elevated on a bench or step.",
        cameraNote: "Show your setup if possible; side view otherwise.",
        tips: ["Hands above shoulder line on your support — still lower chest toward it each rep.", "Keep ribs down and glutes engaged."],
      },
    ],
  },
  {
    id: "squat_family",
    name: "Squat",
    description: "Knee-dominant patterns and holds",
    category: "lower",
    iconKey: "Dumbbell",
    gradient: "from-primary/30 to-primary/10",
    tipsKey: "squat",
    variants: [
      { specId: "squat", name: "Back squat pattern", description: "Depth, knees, and torso." },
      { specId: "goblet_squat", name: "Goblet squat", description: "Front-loaded; chest stays tall." },
      { specId: "front_squat", name: "Front squat pattern", description: "Bar/front rack path and upright torso." },
      { specId: "wall_sit", name: "Wall sit", description: "Isometric thighs parallel — hold quality." },
      { specId: "leg_press", name: "Leg press", description: "Foot placement and knee tracking on the sled." },
      { specId: "leg_extension", name: "Leg extension", description: "Controlled extension; avoid kicking or locking hard." },
      { specId: "leg_curl", name: "Leg curl", description: "Hamstrings — hips stay down, full flexion." },
      { specId: "calf_raise", name: "Calf raise", description: "Full rise through the ankles; control the down phase." },
    ],
  },
  {
    id: "lunge_family",
    name: "Lunge & step",
    description: "Single-leg strength and balance",
    category: "lower",
    iconKey: "Flame",
    gradient: "from-chart-4/30 to-destructive/20",
    tipsKey: "lunge",
    variants: [
      { specId: "lunge", name: "Lunge", description: "Forward or walking-style lunge pattern." },
      { specId: "bulgarian_split_squat", name: "Bulgarian split squat", description: "Rear foot elevated." },
      { specId: "romanian_split_squat", name: "Romanian split squat", description: "Bias hinge on front leg." },
      { specId: "step_up", name: "Step-up", description: "Single-leg drive to top position." },
    ],
  },
  {
    id: "plank_family",
    name: "Plank",
    description: "Anti-extension core holds",
    category: "core",
    iconKey: "Shield",
    gradient: "from-chart-2/30 to-chart-4/20",
    tipsKey: "plank",
    variants: [
      { specId: "plank", name: "Front plank", description: "Forearms or hands under shoulders." },
      { specId: "side_plank", name: "Side plank", description: "Stack hips and shoulders." },
    ],
  },
  {
    id: "hinge_family",
    name: "Deadlift & hinge",
    description: "Hip-dominant pulls and glutes",
    category: "compound",
    iconKey: "Weight",
    gradient: "from-chart-4/35 to-muted/25",
    tipsKey: "deadlift",
    variants: [
      { specId: "deadlift", name: "Deadlift", description: "Hinge with moderate knee bend." },
      { specId: "rdl", name: "Romanian deadlift", description: "Soft knees, big hip hinge." },
      { specId: "kettlebell_swing", name: "Kettlebell swing", description: "Hinge power — arms are straps, not pulling." },
      { specId: "farmer_carry", name: "Farmer carry", description: "Tall posture, even strides, shoulders packed." },
      { specId: "hip_thrust", name: "Hip thrust", description: "Bridge pattern — squeeze glutes at top." },
      { specId: "glute_bridge", name: "Glute bridge", description: "Floor bridge; control at top." },
    ],
  },
  {
    id: "pull_family",
    name: "Pull",
    description: "Rows and vertical pulls",
    category: "upper",
    iconKey: "GripVertical",
    gradient: "from-chart-2/25 to-primary/15",
    tipsKey: "bicep_curl",
    variants: [
      { specId: "pull_up", name: "Pull-up", description: "Overhand vertical pull." },
      { specId: "chin_up", name: "Chin-up", description: "Underhand vertical pull." },
      { specId: "lat_pulldown", name: "Lat pulldown", description: "Cable/bar path to chest." },
      { specId: "barbell_row", name: "Barbell row", description: "Hinged torso, bar to lower ribs." },
      { specId: "dumbbell_row", name: "Dumbbell row", description: "Single-arm or supported row." },
      { specId: "face_pull", name: "Face pull", description: "Pull to face height; external rotation at the end." },
      { specId: "reverse_fly", name: "Reverse fly", description: "Rear delts — slight bend in elbows." },
    ],
  },
  {
    id: "press_family",
    name: "Press & arms",
    description: "Pushes and arm isolation (shoulders, biceps, triceps)",
    category: "upper",
    iconKey: "CircleDot",
    gradient: "from-chart-2/25 to-chart-4/20",
    tipsKey: "shoulder_press",
    variants: [
      { specId: "bench_press", name: "Bench press", description: "Bar path and elbow angle." },
      { specId: "incline_bench_press", name: "Incline bench", description: "Upper-chest bias press." },
      { specId: "shoulder_press", name: "Shoulder press", description: "Overhead path and core brace." },
      { specId: "lateral_raise", name: "Lateral raise", description: "Lead with elbows; control the lowering." },
      { specId: "front_raise", name: "Front raise", description: "Arms forward; avoid shrugging into the neck." },
      {
        specId: "overhead_tricep_extension",
        name: "Overhead tricep extension",
        description: "Elbows stay tucked; extend without flaring ribs.",
      },
      {
        specId: "tricep_pushdown",
        name: "Tricep pushdown",
        description: "Cable or band — elbows fixed, press to lockout.",
        tips: ["Keep shoulders down; don’t lean your whole torso into the stack.", "Elbows stay at your sides or slightly in front of the hips."],
      },
      {
        specId: "tricep_kickback",
        name: "Tricep kickback",
        description: "Hinged torso; extend the forearm with the upper arm still.",
        tips: ["Side or 45° works well so we see elbow bend.", "Stop if the upper arm starts swinging — smaller weight, stricter reps."],
      },
      { specId: "bicep_curl", name: "Bicep curl", description: "Elbows pinned, full ROM." },
      { specId: "hammer_curl", name: "Hammer curl", description: "Neutral grip curl." },
      {
        specId: "concentration_curl",
        name: "Concentration curl",
        description: "Single-arm; elbow on inner thigh, no torso rock.",
        tips: ["Face the camera or show a 45° angle so both arms are visible for tracking.", "Pause at the bottom — no bounce out of the stretch."],
      },
      {
        specId: "preacher_curl",
        name: "Preacher curl",
        description: "Arms on the pad; strict ROM at the elbow.",
        tips: ["Frame your upper body; we need clear shoulder and elbow landmarks.", "Don’t lift your chest off the pad to cheat the top."],
      },
      {
        specId: "incline_dumbbell_curl",
        name: "Incline dumbbell curl",
        description: "Bench ~45°; long-head curl with shoulders back.",
        tips: ["Let arms hang behind the body slightly at the bottom — don’t cut ROM.", "Keep wrists neutral; avoid shrugging as you curl."],
      },
      {
        specId: "cable_bicep_curl",
        name: "Cable bicep curl",
        description: "Bar or single handle; constant tension curls.",
        tips: ["Step back so the stack lifts on the curl, not just your body swaying.", "Elbows stay under shoulders — minimal shoulder drift."],
      },
      { specId: "dip", name: "Dip", description: "Vertical pressing on bars." },
      { specId: "bench_dip", name: "Bench dip", description: "Hands behind on bench." },
    ],
  },
  {
    id: "cardio_family",
    name: "Cardio drills",
    description: "Rhythm and full-body movement",
    category: "cardio",
    iconKey: "Move",
    gradient: "from-chart-4/25 to-primary/20",
    tipsKey: "jumping_jacks",
    variants: [
      { specId: "jumping_jacks", name: "Jumping jacks", description: "Full arm and leg spread." },
      { specId: "high_knees", name: "High knees", description: "Knee drive and quick feet." },
      { specId: "burpee", name: "Burpee", description: "Drop, plank, jump pattern." },
      { specId: "mountain_climber", name: "Mountain climber", description: "Alternating knee drive in plank." },
      { specId: "jump_rope", name: "Jump rope", description: "Light hops and rhythm." },
      { specId: "box_jump", name: "Box jump", description: "Land soft with hips and knees bent; full foot on the box." },
    ],
  },
  {
    id: "core_family",
    name: "Core floor",
    description: "Flexion and anti-rotation on the mat",
    category: "core",
    iconKey: "LayoutList",
    gradient: "from-chart-2/30 to-primary/15",
    tipsKey: "crunch",
    variants: [
      { specId: "crunch", name: "Crunch", description: "Controlled curl; neck relaxed." },
      { specId: "sit_up", name: "Sit-up", description: "Full flexion to vertical torso." },
      { specId: "bicycle_crunch", name: "Bicycle crunch", description: "Rotation and knee meet." },
      { specId: "dead_bug", name: "Dead bug", description: "Low back pressed; limbs alternate." },
      { specId: "bird_dog", name: "Bird dog", description: "Opposite arm/leg reach, stable spine." },
    ],
  },
]

export function getCoachFamily(id: string): CoachFamilyDef | undefined {
  return COACH_EXERCISE_FAMILIES.find((f) => f.id === id)
}

export function findVariantBySpecId(specId: string): { family: CoachFamilyDef; variant: CoachVariantDef } | undefined {
  for (const family of COACH_EXERCISE_FAMILIES) {
    const variant = family.variants.find((v) => v.specId === specId)
    if (variant) return { family, variant }
  }
  return undefined
}

/** Validate catalog against registry at runtime (tests call this too). */
export function assertCoachCatalogSpecsRegistered(): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  for (const fam of COACH_EXERCISE_FAMILIES) {
    for (const v of fam.variants) {
      if (!hasSpec(v.specId)) missing.push(v.specId)
    }
  }
  return { ok: missing.length === 0, missing }
}

export function getDisplayNameForSpec(specId: string): string {
  const spec = loadSpec(specId)
  if (spec?.displayName) return spec.displayName
  const found = findVariantBySpecId(specId)
  return found?.variant.name ?? specId
}

export type ArenaDuelMovementOption = {
  specId: string
  /** Same label persisted on Coach sessions (`exercise`) and Arena duels. */
  duelExerciseLabel: string
  /** Family headline for selects / grouping */
  familyName: string
}

/** Flat catalog for Arena movement picks (one row per verified FormSpec variant). */
export function listArenaDuelMovementOptions(): ArenaDuelMovementOption[] {
  const out: ArenaDuelMovementOption[] = []
  for (const fam of COACH_EXERCISE_FAMILIES) {
    for (const v of fam.variants) {
      out.push({
        specId: v.specId,
        duelExerciseLabel: getDisplayNameForSpec(v.specId),
        familyName: fam.name,
      })
    }
  }
  return out.sort((a, b) => a.duelExerciseLabel.localeCompare(b.duelExerciseLabel))
}

export function getDefaultArenaDuelExerciseLabel(): string {
  return getDisplayNameForSpec("squat")
}

/** Dynamic family for user-authored custom exercises (not in static COACH_EXERCISE_FAMILIES). */
export const MY_EXERCISES_FAMILY_ID = "my_exercises"

export type CustomExercisePickerItem = {
  specId: string
  displayName: string
  description: string
  cameraNote?: string
}

export function customExercisesToFamily(items: CustomExercisePickerItem[]): CoachFamilyDef | null {
  if (!items.length) return null
  return {
    id: MY_EXERCISES_FAMILY_ID,
    name: "My exercises",
    description: "Movements you created with AI form rules",
    category: "compound",
    iconKey: "LayoutList",
    gradient: "from-chart-2/25 to-primary/20",
    tipsKey: "squat",
    variants: items.map((e) => ({
      specId: e.specId,
      name: e.displayName,
      description: e.description.length > 160 ? `${e.description.slice(0, 157)}…` : e.description,
      cameraNote: e.cameraNote,
    })),
  }
}

export function findCustomVariantBySpecId(
  specId: string,
  items: CustomExercisePickerItem[],
): { family: CoachFamilyDef; variant: CoachVariantDef } | undefined {
  const family = customExercisesToFamily(items)
  if (!family) return undefined
  const variant = family.variants.find((v) => v.specId === specId)
  if (!variant) return undefined
  return { family, variant }
}
