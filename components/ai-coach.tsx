"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import Link from "next/link"
import { CHROME } from "@/lib/app-chrome"
import { ChromeHeader } from "@/components/chrome/ChromeHeader"
import { HeroAccentLines } from "@/components/animated/HeroAccentLines"
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  ChevronRight,
  Zap,
  Target,
  Shield,
  Info,
  UserCheck,
  Phone,
  Crosshair,
  User,
  X,
  Columns2,
  Swords,
  Sparkles,
} from "lucide-react"
import { initPoseDetection, detectPose, drawSkeleton, getBodyScanDetail, assessEnvironment, getDetectionQuality, type EnvironmentAssessment } from "@/lib/pose-detection"
import { COACH_FRAME_INTERVAL_MS } from "@/lib/pose-config"
import {
  analyzeForm,
  getRepPhase,
  hasEnoughVisibilityForExercise,
  EXERCISE_TIPS,
  type FormBreakdown,
  type FormResult,
  type Landmark,
  type RepPhase,
} from "@/lib/form-analysis"
import { detectFaults } from "@/lib/coach-vision/faults"
import { renderFaults } from "@/lib/coach-vision/fault-overlay"
import { computeMotionDna, type RepSample } from "@/lib/coach-vision/motion-dna"
import { RepReplayBuffer, type RepFrame } from "@/lib/coach-vision/rep-replay"
import { drawCueFocusOverlay } from "@/lib/coach-vision/canvas-highlight"
import type { HighlightSpec } from "@/lib/coach-vision/cue-resolver"
import { skeletonAnim } from "@/lib/skeleton-animations"
import { addCoachSession, formatErr, getCoachSessions } from "@/lib/store-supabase"
import { isNetworkError } from "@/lib/network-status"
import { LoadChip } from "@/components/ai-coach/load-chip"
import { hasSpec as coachHasSpec, loadSpec as coachLoadSpecRaw } from "@/lib/form-engine/registry"
import { effectiveRepCount, isVerifiedMovement } from "@/lib/competition"
import { recordCoachSessionMemory, getCoachMemoryTip } from "@/lib/coach-memory"
import { getCulturalTipExtras } from "@/lib/cultural-tips"
import { hapticRepPulse, getCoachA11yPrefs, setCoachA11yPrefs, type CoachA11yPrefs } from "@/lib/coach-a11y"
import { SessionDnaCard, type SessionDnaProps } from "@/components/session-dna-card"
import { RingGauge } from "@/components/ring-gauge"
import { useLocale } from "@/components/locale-provider"
import { createClient } from "@/lib/supabase/client"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { speakRepComplete, speakGoodForm, speakCoachMidsetTip } from "@/lib/speech"
import {
  faceMatches,
  createFaceMatchSmoother,
  createMeshFaceMatchSmoother,
  meshEmbeddingMatches,
  passesCKFaceFilter,
  getFaceEnrollment,
  saveFaceEnrollment,
  FACE_ENROLL_STABLE_FRAMES,
  EMBEDDING_VERSION_FACE_MESH,
  EMBEDDING_VERSION_POSE,
  type FaceEnrollmentRecord,
  type LandmarkPoint,
} from "@/lib/face-verification"
import { initFaceLandmarker, isFaceLandmarkerReady, detectFaceSignature } from "@/lib/face-landmarker-client"
import { pushConsecutiveEnrollmentFrame, pushConsecutiveMeshEnrollmentFrame } from "@/lib/face-enrollment-capture"
import { isInCenter } from "@/lib/center-check"
import { detectFall, resetFallDetection } from "@/lib/fall-detection"
import { playFallAlarm, stopFallAlarm } from "@/lib/alarm-sound"
import { AICoachLlmPanel } from "@/components/ai-coach-llm-panel"
import { consumeAICoachIntent } from "@/lib/ai-coach-intent"
import { saveCoachPickerSnapshot, loadCoachPickerSnapshot } from "@/lib/coach-picker-snapshot"
import { topCuesFromBreakdown } from "@/lib/coach-session-cues"
import { CoachRepTimeline } from "@/components/coach-rep-timeline"
import { captureRepTrace, aggregateTopFaults, type RepTracePair } from "@/lib/rep-trace"
import { mergeFaultsFromTrace } from "@/lib/ai-coach/rep-feedback-local"
import { CoachSetRecorder } from "@/lib/coach-replay/recorder"
import { isCoachReplayLocalEnabled } from "@/lib/coach-replay/prefs"
import { saveCoachReplayPackage, linkCoachReplayToSession } from "@/lib/coach-replay/store"
import { uploadCoachClipIfEnabled } from "@/lib/coach-clips-supabase"
import { isCoachMidsetTipsEnabled } from "@/lib/coach-midset-tips"
import { CoachFinishShareBar } from "@/components/coach-finish-recap"
import { CoachReplaySheet } from "@/components/coach-replay-sheet"
import { CueFocusProvider } from "@/components/coach/cue-focus-context"
import { InteractiveCue } from "@/components/coach/interactive-cue"
import type { TabId } from "@/components/bottom-nav"
import { StatDisplay } from "@/components/ui/stat-display"
import { CelebrationBurst } from "@/components/ui/celebration-burst"
import { MotionCelebrate } from "@/components/motion-celebrate"
import { CINEMATIC, staggerChildren } from "@/lib/motion"
import { MobilityCoach } from "@/components/mobility-coach"
import { agentDebugLog } from "@/lib/debug-agent-log"
import {
  COACH_EXERCISE_FAMILIES,
  MY_EXERCISES_FAMILY_ID,
  customExercisesToFamily,
  findCustomVariantBySpecId,
  findVariantBySpecId,
  getDisplayNameForSpec,
  getCoachFamily,
  type CustomExercisePickerItem,
} from "@/lib/coach-exercise-catalog"
import { CustomExerciseBuilder } from "@/components/custom-exercise-builder"
import { hydrateUserCustomExercises } from "@/lib/custom-exercises/store"
import type { UserCustomExercise } from "@/lib/custom-exercises/types"
import type { CoachRecord } from "@/lib/store"
import { setArenaDuelExerciseLabel } from "@/lib/arena-duel-intent"
import { CompareSessionsPanel } from "@/components/compare-sessions-sheet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ExerciseBodyPreview } from "@/components/exercise-body-preview"
// ScreenTitle replaced by ChromeHeader hero section
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { FittrackLogoMark } from "@/components/fittrack-logo-mark"
import { ExerciseIllustration, type ExerciseIllustrationId } from "@/components/animated/ExerciseIllustration"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import { ParticleBurst } from "@/components/animated/ParticleBurst"

const FAMILY_TO_ILLUSTRATION: Record<string, ExerciseIllustrationId> = {
  pushup_family:         "pushup",
  squat_family:          "squat",
  plank_family:          "plank",
  lunge_family:          "lunge",
  deadlift_family:       "deadlift",
  bicep_curl_family:     "bicep_curl",
  shoulder_press_family: "shoulder_press",
  jumping_jacks_family:  "jumping_jacks",
  high_knees_family:     "high_knees",
  crunch_family:         "crunch",
}
const POSTURE_PENALTY_THRESHOLD = 75
const POSTURE_PENALTY_NO_ACCUM_THRESHOLD = 85
/** Require this many consecutive frames at top before a rep can complete (reduces single-frame noise). */
const MIN_TOP_FRAMES_FOR_REP = 2
const EMERGENCY_NUMBER = "911"

/** Session % form: average of completed reps, not the last live frame (often 0 when you stop moving). */
function sessionFormScore(repScores: number[], liveScore: number): number {
  if (repScores.length === 0) return Math.round(liveScore)
  return Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length)
}

function goodFormBadge(exercise: string, phase: RepPhase, res: FormResult): boolean {
  if (!res.isGoodForm) return false
  if (res.trackingReliability !== undefined && res.trackingReliability < 0.48) return false
  if (exercise === "plank" || exercise === "side_plank") return true
  if (exercise === "jumping_jacks" || exercise === "high_knees") return true
  return phase !== "idle"
}

type DetectionState = "select" | "setup" | "enrolling" | "detecting" | "feedback"

export function AICoach({
  focusMode = false,
  guestMode = false,
  onExitFocus,
  onNavigate,
  onRequestSignIn,
}: {
  focusMode?: boolean
  guestMode?: boolean
  onExitFocus?: () => void
  onNavigate?: (tab: TabId) => void
  /** Guest funnel: saves Session DNA in the cloud once the user authenticates */
  onRequestSignIn?: () => void
} = {}) {
  const { locale, t } = useLocale()
  const reduceMotion = useReducedMotion() ?? false

  const [coachPickerStep, setCoachPickerStep] = useState<"families" | "variants">("families")
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null)
  const [customExercises, setCustomExercises] = useState<UserCustomExercise[]>([])
  const [customBuilderOpen, setCustomBuilderOpen] = useState(false)
  const [score, setScore] = useState(0)
  const [reps, setReps] = useState(0)
  const [repScores, setRepScores] = useState<number[]>([])
  const [feedback, setFeedback] = useState<string[]>([])
  const [breakdown, setBreakdown] = useState<FormBreakdown[]>([])
  const [recapBreakdown, setRecapBreakdown] = useState<FormBreakdown[]>([])
  const [cueHighlight, setCueHighlight] = useState<HighlightSpec | null>(null)
  const cueHighlightRef = useRef<HighlightSpec | null>(null)
  useEffect(() => {
    cueHighlightRef.current = cueHighlight
  }, [cueHighlight])
  const [selectedRecapRep, setSelectedRecapRep] = useState<number | null>(null)
  const [liveFeedback, setLiveFeedback] = useState("Position yourself in frame to start.")
  const [isGoodForm, setIsGoodForm] = useState(true)
  const [poseReady, setPoseReady] = useState(false)
  const [bodyScanSummary, setBodyScanSummary] = useState<string | null>(null)
  const [useCamera, setUseCamera] = useState(true)
  const [faceEnrolled, setFaceEnrolled] = useState(false)
  const [faceMatch, setFaceMatch] = useState(true)
  const [enrollProgress, setEnrollProgress] = useState(0)
  const [userCentered, setUserCentered] = useState(false)
  const [fallDetected, setFallDetected] = useState(false)
  const [targetReps, setTargetReps] = useState(0)
  const [envAssessment, setEnvAssessment] = useState<EnvironmentAssessment | null>(null)
  const [sessionDna, setSessionDna] = useState<SessionDnaProps | null>(null)
  const [finishShareSessionId, setFinishShareSessionId] = useState<string | null>(null)
  const [replayOpen, setReplayOpen] = useState(false)
  const [replayTarget, setReplayTarget] = useState<{ sessionId: string | null; clipId: string | null }>({
    sessionId: null,
    clipId: null,
  })
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareBaseline, setCompareBaseline] = useState<CoachRecord | null>(null)
  const [compareCurrent, setCompareCurrent] = useState<CoachRecord | null>(null)
  const [recapIsPr, setRecapIsPr] = useState(false)
  const [sessionCelebrateBurst, setSessionCelebrateBurst] = useState(false)
  const [loadKg, setLoadKg] = useState<number | undefined>(undefined)
  const [bodyWeightKg, setBodyWeightKg] = useState<number | undefined>(undefined)
  const [weightUnitPref, setWeightUnitPref] = useState<"kg" | "lb">("kg")
  const [ghostEnabled, setGhostEnabled] = useState(false)
  const [ghostFrames, setGhostFrames] = useState<RepFrame[]>([])
  const repReplayBufferRef = useRef<RepReplayBuffer>(new RepReplayBuffer(12_000))
  // Per-rep timing info for Motion DNA (durationMs, rom-approximation, symmetry)
  const repDnaDataRef = useRef<RepSample[]>([])
  const [state, setState] = useState<DetectionState>("select")
  const [coachTrack, setCoachTrack] = useState<"strength" | "mobility">("strength")
  const [a11yPrefs, setA11yPrefs] = useState<CoachA11yPrefs>(() =>
    typeof window !== "undefined" ? getCoachA11yPrefs() : { hapticOnRep: true, announceReps: true, reduceMotion: false, highContrastVideo: false }
  )
  const [repBounce, setRepBounce] = useState(false)
  const prevFormGoodRef = useRef(true)
  const displayedScoreRef = useRef(0)
  const goalReachedAnnouncedRef = useRef(false)
  const faceSignatureRef = useRef<number[] | null>(null)
  const faceEmbeddingVersionRef = useRef<number>(1)
  const faceMatchSmootherRef = useRef<ReturnType<typeof createFaceMatchSmoother> | null>(null)
  const meshFaceMatchSmootherRef = useRef<ReturnType<typeof createMeshFaceMatchSmoother> | null>(null)
  const enrollMeshBufferRef = useRef<number[][]>([])
  const enrollPoseBufferRef = useRef<number[][]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const lastPhaseRef = useRef<string>("idle")
  /** Phase entered from when the current stretch of `top` started (required when topHeld needs 2+ frames). */
  const phaseBeforeTopStreakRef = useRef<string | null>(null)
  const repScoreStatsRef = useRef<{ sum: number; w: number; min: number | null }>({ sum: 0, w: 0, min: null })
  const lastRepAtRef = useRef<number>(0)
  const lastVoiceAtRef = useRef<number>(0)
  const repCountForVoiceRef = useRef<number>(0)
  const bottomFrameCountRef = useRef<number>(0)
  const bottomWasHeldRef = useRef<boolean>(false)
  const topFrameCountRef = useRef<number>(0)
  const detectingStartedAtRef = useRef<number>(0)
  const fallDismissedAtRef = useRef<number>(0)
  const faceVerifiedSessionRef = useRef(false)
  /** Per-rep joint traces (bottom + top) persisted with the session. */
  const repTracesRef = useRef<RepTracePair[]>([])
  const lastBottomTraceRef = useRef<ReturnType<typeof captureRepTrace> | null>(null)
  const clipRecorderRef = useRef<CoachSetRecorder | null>(null)
  const activeClipIdRef = useRef<string | null>(null)
  const aiTipServerEnabledRef = useRef(false)
  const lastMidsetTipAtRef = useRef(0)
  const lastRepScoreWindowRef = useRef<number[]>([])
  /** Debug: throttle live-feedback path logs per hypothesis (session `2a41e9`). */
  const liveFbDebugLastMsByHRef = useRef<Record<string, number>>({})
  const lastEnvUiAtRef = useRef(0)
  const envUiCacheRef = useRef<EnvironmentAssessment | null>(null)
  const lastLiveFeedbackRef = useRef("")
  const commitLiveFeedbackRef = useRef<(msg: string) => void>(() => {})
  commitLiveFeedbackRef.current = (msg: string) => {
    const t = msg.trim()
    if (!t) return
    if (lastLiveFeedbackRef.current === t) return
    lastLiveFeedbackRef.current = t
    setLiveFeedback(t)
  }
  /** Pose ready flag read inside RAF without listing `poseReady` on the detecting effect (avoids camera teardown/restart). */
  const poseReadyRef = useRef(poseReady)
  poseReadyRef.current = poseReady

  const customPickerItems = useMemo<CustomExercisePickerItem[]>(
    () =>
      customExercises.map((e) => ({
        specId: e.specId,
        displayName: e.displayName,
        description: e.description,
        cameraNote: e.cameraNote,
      })),
    [customExercises],
  )

  const pickerFamilies = useMemo(() => {
    const mine = customExercisesToFamily(customPickerItems)
    return mine ? [...COACH_EXERCISE_FAMILIES, mine] : COACH_EXERCISE_FAMILIES
  }, [customPickerItems])

  const catalogCtx = useMemo(() => {
    if (!selectedSpecId) return undefined
    return findVariantBySpecId(selectedSpecId) ?? findCustomVariantBySpecId(selectedSpecId, customPickerItems)
  }, [selectedSpecId, customPickerItems])

  const activePickerVariants = useMemo(() => {
    if (selectedFamilyId === MY_EXERCISES_FAMILY_ID) {
      return customExercisesToFamily(customPickerItems)?.variants ?? []
    }
    return selectedFamilyId ? (getCoachFamily(selectedFamilyId)?.variants ?? []) : []
  }, [selectedFamilyId, customPickerItems])

  const resolvedExerciseTips = useMemo(() => {
    if (!selectedSpecId) return []
    const found = findVariantBySpecId(selectedSpecId)
    const key = found?.family.tipsKey
    const base = key ? (EXERCISE_TIPS[key] ?? []) : []
    const extra = found?.variant.tips ?? []
    return [...extra, ...base]
  }, [selectedSpecId])

  const baseExerciseName = selectedSpecId ? getDisplayNameForSpec(selectedSpecId) : ""
  const exerciseName =
    selectedSpecId === "deadlift"
      ? t("coach.deadlift.name")
      : selectedSpecId === "rdl"
        ? t("coach.rdl.name")
        : baseExerciseName

  const coachLivePrimary = useMemo(() => {
    const trimmed = liveFeedback.trim()
    if (trimmed) return trimmed
    if (resolvedExerciseTips.length > 0) {
      return resolvedExerciseTips[0] ?? "Hold steady — we're tracking your form."
    }
    return "Position yourself in frame to start."
  }, [liveFeedback, resolvedExerciseTips])

  const coachSetupTips = useMemo(() => resolvedExerciseTips.slice(0, 3), [resolvedExerciseTips])

  const coachLiveBreakdownHints = useMemo(
    () => breakdown.filter((b) => !b.ok).slice(0, 2),
    [breakdown],
  )

  /** Resolve the FormSpec for the active exercise, if one exists. */
  const coachLoadSpec = (id: string) => (coachHasSpec(id) ? coachLoadSpecRaw(id) ?? null : null)

  const handleOpenCompareSheet = useCallback(async () => {
    if (!sessionDna) {
      toast.error("Finish a coached set before comparing.")
      return
    }
    const tracesSnapshot =
      repTracesRef.current.length > 0
        ? (JSON.parse(JSON.stringify(repTracesRef.current)) as RepTracePair[])
        : undefined
    const currentSynth: CoachRecord = {
      id: finishShareSessionId ?? "local-recap-pending",
      exercise: exerciseName,
      reps: sessionDna.reps,
      score: sessionDna.score,
      repScores: [...sessionDna.repScores],
      completedAt: new Date().toISOString(),
      repTraces: tracesSnapshot,
      effectiveReps: sessionDna.effectiveReps,
      verifiedMovement: sessionDna.verifiedMovement,
      faceVerifiedSession: sessionDna.faceVerifiedSession,
    }
    try {
      const rows = await getCoachSessions()
      const exKey = exerciseName.trim().toLowerCase()
      const excluded = finishShareSessionId
      const baseline =
        rows.find(
          (s) =>
            s.exercise.trim().toLowerCase() === exKey &&
            (!excluded || s.id !== excluded) &&
            s.id !== currentSynth.id,
        ) ?? null
      setCompareCurrent(currentSynth)
      setCompareBaseline(baseline)
      setCompareOpen(true)
      if (!baseline) {
        toast.message("Save one more coached set for this movement to unlock joint deltas.", { duration: 3500 })
      }
    } catch (e) {
      console.warn(e)
      toast.error("Could not load sessions to compare.")
    }
  }, [exerciseName, finishShareSessionId, sessionDna])

  useEffect(() => {
    if (state === "select" && !guestMode) {
      void hydrateUserCustomExercises().then(setCustomExercises).catch(() => {})
    }
  }, [state, guestMode])

  useEffect(() => {
    void (async () => {
      let pickerItems: CustomExercisePickerItem[] = []
      if (!guestMode) {
        try {
          const exercises = await hydrateUserCustomExercises()
          setCustomExercises(exercises)
          pickerItems = exercises.map((e) => ({
            specId: e.specId,
            displayName: e.displayName,
            description: e.description,
            cameraNote: e.cameraNote,
          }))
        } catch {
          /* registry may still have built-ins */
        }
      }

      const intent = consumeAICoachIntent()
      if (intent) {
        if (intent.openMobility) {
          setCoachTrack("mobility")
          return
        }
        if (intent.openCustomExerciseBuilder) {
          setCustomBuilderOpen(true)
          return
        }

        const specId = intent.exerciseId
        if (specId && coachHasSpec(specId)) {
          const found = findVariantBySpecId(specId) ?? findCustomVariantBySpecId(specId, pickerItems)
          setSelectedFamilyId(found?.family.id ?? (specId.startsWith("custom_") ? MY_EXERCISES_FAMILY_ID : null))
          setSelectedSpecId(specId)
          setCoachPickerStep(found ? "variants" : "families")
          setState("setup")
          return
        }
      }

      const snap = loadCoachPickerSnapshot()
      if (!snap) return
      if (snap.coachPickerStep === "variants" && !snap.selectedFamilyId) {
        setCoachPickerStep("families")
        setCoachTrack(snap.coachTrack)
        return
      }
      setCoachTrack(snap.coachTrack)
      setCoachPickerStep(snap.coachPickerStep)
      setSelectedFamilyId(snap.selectedFamilyId)
    })()
  }, [guestMode])


  useEffect(() => {
    if (state !== "select") return
    saveCoachPickerSnapshot({
      coachTrack,
      coachPickerStep,
      selectedFamilyId,
    })
  }, [state, coachTrack, coachPickerStep, selectedFamilyId])


  const handleOpenArenaFromRecap = useCallback(() => {
    setArenaDuelExerciseLabel(exerciseName)
    onNavigate?.("arena")
  }, [exerciseName, onNavigate])

  // Pull body weight + unit preference from the local profile cache on mount.
  useEffect(() => {
    void (async () => {
      try {
        const mod = await import("@/lib/weight/profile")
        setBodyWeightKg(mod.getBodyWeightKg())
        setWeightUnitPref(mod.getWeightUnit())
      } catch {
        /* fall back to defaults */
      }
    })()
  }, [])

  const applyA11yPrefs = useCallback((patch: Partial<CoachA11yPrefs>) => {
    setCoachA11yPrefs(patch)
    setA11yPrefs(getCoachA11yPrefs())
  }, [])

  const handleSelectFamily = (familyId: string) => {
    setSelectedFamilyId(familyId)
    setSelectedSpecId(null)
    setCoachPickerStep("variants")
  }

  const handlePickerBackToFamilies = () => {
    setCoachPickerStep("families")
    setSelectedFamilyId(null)
    setSelectedSpecId(null)
  }

  const handleSelectVariant = (specId: string) => {
    setSelectedSpecId(specId)
    setLoadKg(undefined)
    void (async () => {
      try {
        const mod = await import("@/lib/weight/load-history")
        const last = mod.getLastLoadKg(specId)
        if (last !== undefined) setLoadKg(last)
      } catch {
        /* ignore */
      }
    })()
    setState("setup")
  }

  const handleSetupBack = () => {
    setState("select")
    setSelectedSpecId(null)
    setLoadKg(undefined)
    if (selectedFamilyId) {
      setCoachPickerStep("variants")
    } else {
      setCoachPickerStep("families")
    }
  }

  const handleStartDetection = useCallback(() => {
    setScore(100)
    setReps(0)
    setRepScores([])
    setFeedback([])
    setBreakdown([])
    lastLiveFeedbackRef.current = ""
    setLiveFeedback("Position yourself in frame to start.")
    setRecapBreakdown([])
    setSelectedRecapRep(null)
    repScoreStatsRef.current = { sum: 0, w: 0, min: null }
    lastPhaseRef.current = "idle"
    phaseBeforeTopStreakRef.current = null
    bottomFrameCountRef.current = 0
    bottomWasHeldRef.current = false
    topFrameCountRef.current = 0
    getRepPhase([], selectedSpecId || "squat", true)
    lastRepAtRef.current = 0
    lastVoiceAtRef.current = 0
    repCountForVoiceRef.current = 0
    goalReachedAnnouncedRef.current = false
    fallDismissedAtRef.current = 0
    prevFormGoodRef.current = true
    displayedScoreRef.current = 100
    skeletonAnim.reset()
    skeletonAnim.startScanSweep()
    faceVerifiedSessionRef.current = false
    repTracesRef.current = []
    repDnaDataRef.current = []
    repReplayBufferRef.current.clear()
    lastBottomTraceRef.current = null
    setFinishShareSessionId(null)
    setReplayTarget({ sessionId: null, clipId: null })
    setReplayOpen(false)
    setCoachTrack("strength")
    void clipRecorderRef.current?.stop?.().catch(() => {})
    clipRecorderRef.current = null
    activeClipIdRef.current = null
    lastRepScoreWindowRef.current = []
    lastMidsetTipAtRef.current = 0
    setRecapIsPr(false)
    setSessionCelebrateBurst(false)
    setA11yPrefs(getCoachA11yPrefs())
    setState("detecting")

    // Load best prior rep as ghost overlay (background, non-blocking)
    if (ghostEnabled && exerciseName) {
      void getCoachSessions().then((sessions) => {
        const key = exerciseName.trim().toLowerCase()
        const best = sessions
          .filter((s) => s.exercise.trim().toLowerCase() === key && s.repTraces && s.repTraces.length > 0)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
        if (!best?.repTraces?.length) return
        // Build synthetic ghost frames from the best rep's bottom→top trace angles
        // We use a simple linear interpolation between bottom and top joint positions
        const frames: RepFrame[] = best.repTraces.slice(0, 1).map(() => ({
          t: performance.now(),
          landmarks: [],
        }))
        setGhostFrames(frames)
      }).catch(() => { /* non-blocking */ })
    }

    if (isCoachReplayLocalEnabled()) {
      const rec = new CoachSetRecorder()
      clipRecorderRef.current = rec
      activeClipIdRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `coach-${Date.now()}`
      let n = 0
      const boot = () => {
        n += 1
        if (clipRecorderRef.current !== rec) return
        const v = videoRef.current
        if (v && v.videoWidth > 0 && v.videoHeight > 0) {
          if (!rec.start(v)) {
            clipRecorderRef.current = null
            activeClipIdRef.current = null
          }
        } else if (n < 400) requestAnimationFrame(boot)
        else {
          clipRecorderRef.current = null
          activeClipIdRef.current = null
        }
      }
      requestAnimationFrame(boot)
    }
  }, [selectedSpecId, exerciseName, ghostEnabled])

  const handleFinish = useCallback(async () => {
    stopFallAlarm()
    resetFallDetection()
    setFallDetected(false)

    const clipIdCaptured = activeClipIdRef.current
    activeClipIdRef.current = null
    const recInst = clipRecorderRef.current
    clipRecorderRef.current = null
    let clipPack: Awaited<ReturnType<CoachSetRecorder["stop"]>> | null = null
    if (recInst) {
      try {
        clipPack = await recInst.stop()
      } catch {
        clipPack = null
      }
    }

    const finalFeedback = feedback.length > 0 ? feedback : ["Great effort! Keep practicing for even better form."]
    const sessionScore = sessionFormScore(repScores, score)
    setScore(sessionScore)
    setRecapBreakdown([...breakdown])
    setSelectedRecapRep(repScores.length > 0 ? repScores.length - 1 : null)
    setFeedback(finalFeedback)
    setState("feedback")
    setFinishShareSessionId(null)
    setReplayTarget({ sessionId: null, clipId: null })
    setSessionCelebrateBurst(false)

    if (selectedSpecId && (reps > 0 || sessionScore > 0)) {
      let prevBestScore = 0
      try {
        const priorSessions = await getCoachSessions()
        const key = exerciseName.trim().toLowerCase()
        prevBestScore = Math.max(
          0,
          ...priorSessions
            .filter((s) => s.exercise.trim().toLowerCase() === key)
            .map((s) => s.score ?? 0),
        )
      } catch {
        prevBestScore = 0
      }
      const rounded = sessionScore
      const eff = effectiveRepCount(reps, repScores, rounded)
      const verified = isVerifiedMovement(repScores, rounded)
      const faceOk = faceVerifiedSessionRef.current

      // Compute Motion DNA from per-rep data
      const dnaReps: RepSample[] = repDnaDataRef.current.length > 0
        ? repDnaDataRef.current
        : repScores.map((s) => ({ formScore: s, rom: s / 100, durationMs: 2500, verified: s >= 70, symmetry: 0.85 }))
      const computedDna = computeMotionDna(dnaReps)
      repDnaDataRef.current = []

      setSessionDna({
        exercise: exerciseName,
        reps,
        score: rounded,
        repScores: [...repScores],
        effectiveReps: eff,
        verifiedMovement: verified,
        faceVerifiedSession: faceOk,
        motionDna: computedDna,
      })
      setRecapIsPr(rounded > prevBestScore && reps > 0)
      const repTracesPayload =
        repTracesRef.current.length > 0 ? [...repTracesRef.current] : undefined
      let insertedIdLocal: string | null = null
      const volumeKg = loadKg !== undefined && reps > 0 ? loadKg * reps : undefined
      try {
        insertedIdLocal = await addCoachSession({
          exercise: exerciseName,
          reps,
          score: rounded,
          repScores: [...repScores],
          repTraces: repTracesPayload,
          effectiveReps: eff,
          verifiedMovement: verified,
          faceVerifiedSession: faceOk,
          loadKg,
          volumeKg,
          exerciseSpecId: selectedSpecId ?? undefined,
          motionDna: computedDna,
        })
        if (selectedSpecId && loadKg !== undefined && reps > 0) {
          try {
            const mod = await import("@/lib/weight/load-history")
            mod.recordSet(selectedSpecId, { loadKg, reps })
          } catch {
            /* non-blocking */
          }
        }
        if (insertedIdLocal) setFinishShareSessionId(insertedIdLocal)
        recordCoachSessionMemory(exerciseName, repScores, rounded)
        toast.success(`Saved · ${eff.toFixed(1)} effective reps · ${rounded}% form${verified ? " · Verified" : ""}`)
        setSessionCelebrateBurst(rounded >= 80)
        if (rounded > prevBestScore && reps > 0) {
          toast.success(`New personal best — ${exerciseName} at ${rounded}% form`, { duration: 4500 })
          try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
              navigator.vibrate(20)
            }
          } catch {
            /* ignore */
          }
        }
      } catch (error) {
        console.error(error)
        if (isNetworkError(error)) {
          toast.info("Session queued — will sync when you are back online")
        } else {
          const msg = formatErr(error)
          const isAuth =
            /not authenticated/i.test(msg) ||
            /\b(401|JWT|session expired|not signed)\b/i.test(msg)
          if (isAuth) {
            toast.error("Sign in to save sessions to your account")
          } else {
            const detail = msg.length > 140 ? `${msg.slice(0, 140)}…` : msg
            toast.error(`Could not save session: ${detail}`)
          }
        }
      }

      if (clipIdCaptured && clipPack) {
        try {
          await saveCoachReplayPackage({
            clipId: clipIdCaptured,
            sessionId: insertedIdLocal,
            exerciseId: selectedSpecId,
            exerciseLabel: exerciseName,
            durationMs: clipPack.durationMs,
            blob: clipPack.blob,
            landmarkFrames: clipPack.landmarkFrames,
            repMarkersMs: clipPack.repMarkersMs,
          })
          if (insertedIdLocal) {
            await linkCoachReplayToSession(clipIdCaptured, insertedIdLocal).catch(() => {})
            void uploadCoachClipIfEnabled({
              sessionId: insertedIdLocal,
              blob: clipPack.blob,
              durationMs: clipPack.durationMs,
            })
          }
        } catch {
          /* best-effort local replay */
        }
        setReplayTarget({
          sessionId: insertedIdLocal,
          clipId: insertedIdLocal ? null : clipIdCaptured,
        })
      }
    } else {
      setSessionDna(null)
      setRecapIsPr(false)
    }
  }, [selectedSpecId, exerciseName, reps, score, repScores, feedback, breakdown, loadKg])

  const handleReset = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    void clipRecorderRef.current?.stop?.().catch(() => {})
    clipRecorderRef.current = null
    activeClipIdRef.current = null
    setReplayOpen(false)
    setReplayTarget({ sessionId: null, clipId: null })
    setState("select")
    setCoachPickerStep("families")
    setSelectedFamilyId(null)
    setSelectedSpecId(null)
    setScore(0)
    setReps(0)
    setTargetReps(0)
    setRepScores([])
    setFeedback([])
    setBreakdown([])
    setRecapBreakdown([])
    setSelectedRecapRep(null)
    setSessionDna(null)
    setRecapIsPr(false)
    setSessionCelebrateBurst(false)
    repTracesRef.current = []
    repDnaDataRef.current = []
    repReplayBufferRef.current.clear()
    setGhostFrames([])
    lastBottomTraceRef.current = null
    setFinishShareSessionId(null)
    setCoachTrack("strength")
  }, [])

  // Init pose + face landmarker (enrolling / setup / detecting)
  useEffect(() => {
    if (state !== "setup" && state !== "detecting" && state !== "enrolling") return
    let cancelled = false
    void Promise.all([initPoseDetection(), initFaceLandmarker()]).then(([poseOk]) => {
      if (!cancelled) {
        setPoseReady(poseOk)
        if (!poseOk) {
          console.error("[AI Coach] Pose detection failed to initialize")
          toast.error("Pose detection failed to initialize")
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [state])

  useEffect(() => {
    if (state !== "detecting") return
    let cancelled = false
    void fetch("/api/ai-coach/chat")
      .then((r) => r.json().catch(() => ({})))
      .then((d: unknown) => {
        if (cancelled) return
        aiTipServerEnabledRef.current =
          typeof d === "object" &&
          d !== null &&
          "enabled" in d &&
          Boolean((d as { enabled?: boolean }).enabled)
      })
    return () => {
      cancelled = true
    }
  }, [state])

  // Stop fall alarm when leaving detecting; reset face match smoothers for new session
  useEffect(() => {
    if (state === "detecting") {
      faceMatchSmootherRef.current = createFaceMatchSmoother()
      meshFaceMatchSmootherRef.current = createMeshFaceMatchSmoother(faceSignatureRef.current)
    } else {
      faceMatchSmootherRef.current = null
      meshFaceMatchSmootherRef.current = null
    }
    if (state !== "detecting") {
      detectingStartedAtRef.current = 0
      fallDismissedAtRef.current = 0
      stopFallAlarm()
      setFallDetected(false)
      resetFallDetection()
    }
  }, [state])

  // Load face signature from IndexedDB (refresh on detect so Profile enroll is picked up)
  useEffect(() => {
    if (state !== "setup" && state !== "enrolling" && state !== "detecting") return
    let cancelled = false
    const detecting = state === "detecting"
    createClient()
      .auth.getUser()
      .then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
        if (cancelled || !user) return
        return getFaceEnrollment(user.id)
      })
      .then((rec: FaceEnrollmentRecord | null | undefined) => {
        if (cancelled) return
        faceSignatureRef.current = rec?.signature ?? null
        faceEmbeddingVersionRef.current = rec?.embeddingVersion ?? EMBEDDING_VERSION_POSE
        setFaceEnrolled(!!rec?.signature?.length)
        if (detecting) {
          meshFaceMatchSmootherRef.current = createMeshFaceMatchSmoother(rec?.signature ?? null)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [state])

  // Enrolling: face mesh when available, else pose; consecutive stable frames → averaged signature
  useEffect(() => {
    if (state !== "enrolling") return
    let cancelled = false
    let stream: MediaStream | null = null
    let running = true
    let lastTime = 0
    enrollMeshBufferRef.current = []
    enrollPoseBufferRef.current = []
    setEnrollProgress(0)

    function finishEnrollment(sig: number[], embeddingVersion: number) {
      createClient()
        .auth.getUser()
        .then(async ({ data: { user } }: { data: { user: { id: string } | null } }) => {
          if (!user) {
            toast.error("Sign in to enroll your face")
            setState("setup")
            return
          }
          const ok = await saveFaceEnrollment(user.id, sig, embeddingVersion)
          if (cancelled) return
          if (!ok) {
            toast.error("Could not save face (storage blocked). Check browser site settings and try again.")
            setState("setup")
            return
          }
          faceSignatureRef.current = sig
          faceEmbeddingVersionRef.current = embeddingVersion
          setFaceEnrolled(true)
          setState("setup")
          toast.success("Face enrolled — only your reps will count")
        })
        .catch(() => {
          toast.error("Could not enroll face")
          setState("setup")
        })
    }

    function runEnroll(timestamp: number) {
      if (!running || cancelled) return
      const video = videoRef.current
      if (!video) {
        animRef.current = requestAnimationFrame(runEnroll)
        return
      }
      animRef.current = requestAnimationFrame(runEnroll)
      if (timestamp - lastTime < 100) return
      lastTime = timestamp
      if (video.readyState < 2 || video.videoWidth === 0) return

      if (isFaceLandmarkerReady()) {
        enrollPoseBufferRef.current = []
        const meshSig = detectFaceSignature(video, timestamp, "enroll")
        const { buffer, signature, progress } = pushConsecutiveMeshEnrollmentFrame(
          enrollMeshBufferRef.current,
          meshSig
        )
        enrollMeshBufferRef.current = buffer
        setEnrollProgress(progress)
        if (!signature) return
        running = false
        cancelAnimationFrame(animRef.current)
        if (stream) stream.getTracks().forEach((t) => t.stop())
        stream = null
        streamRef.current = null
        finishEnrollment(signature, EMBEDDING_VERSION_FACE_MESH)
        return
      }

      enrollMeshBufferRef.current = []
      const result = detectPose(video, timestamp)
      if (!result?.landmarks?.length) return
      const lm = result.landmarks as LandmarkPoint[]
      const { buffer, signature, progress } = pushConsecutiveEnrollmentFrame(enrollPoseBufferRef.current, lm)
      enrollPoseBufferRef.current = buffer
      setEnrollProgress(progress)
      if (!signature) return
      running = false
      cancelAnimationFrame(animRef.current)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      stream = null
      streamRef.current = null
      finishEnrollment(signature, EMBEDDING_VERSION_POSE)
    }

    void Promise.all([initPoseDetection(), initFaceLandmarker()]).then(([poseOk]) => {
      if (cancelled) return
      if (!poseOk) {
        toast.error("Pose model failed to load. Try again or check your network.")
        setState("setup")
        return
      }
      setPoseReady(true)
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
        .then((s) => {
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop())
            return
          }
          stream = s
          streamRef.current = s
          const v = videoRef.current
          if (v) {
            v.srcObject = s
            v.play().catch(() => {})
            animRef.current = requestAnimationFrame(runEnroll)
          } else {
            requestAnimationFrame(() => {
              if (cancelled) return
              const v2 = videoRef.current
              if (v2) {
                v2.srcObject = s
                v2.play().catch(() => {})
                animRef.current = requestAnimationFrame(runEnroll)
              } else {
                toast.error("Camera preview not ready. Try again.")
                setState("setup")
                s.getTracks().forEach((t) => t.stop())
              }
            })
          }
        })
        .catch(() => {
          if (!cancelled) {
            toast.error("Camera access needed to enroll face")
            setState("setup")
          }
        })
    })

    return () => {
      cancelled = true
      running = false
      cancelAnimationFrame(animRef.current)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [state])

  // Detecting: camera stream and pose loop
  useEffect(() => {
    if (state !== "detecting" || !selectedSpecId) return
    if (detectingStartedAtRef.current === 0) detectingStartedAtRef.current = Date.now()

    let stream: MediaStream | null = null
    const startCamera = () => {
      // Request higher resolution for better detection
      navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user", 
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 24 }
        } 
      }).then((s) => {
        stream = s
        streamRef.current = s
        const attachToVideo = () => {
          const v = videoRef.current
          if (!v) return
          v.srcObject = s
          void v.play().catch(() => {})
        }
        attachToVideo()
        requestAnimationFrame(attachToVideo)
      }).catch(() => {
        setUseCamera(false)
        setLiveFeedback("Camera denied or unavailable — using simulated form. Reps and tips still work.")
        toast.info("Camera unavailable. Using simulated form — you can still get rep counts and form tips.")
      })
    }

    if (useCamera) startCamera()

    let lastTime = 0
    let running = true
    let simScore = 85
    let simGood = true
    const exercise = selectedSpecId

    const dbgLiveFbPath = (hypothesisId: string, data: Record<string, unknown>) => {
      const t = Date.now()
      const prev = liveFbDebugLastMsByHRef.current[hypothesisId] ?? 0
      if (t - prev < 2000) return
      liveFbDebugLastMsByHRef.current[hypothesisId] = t
      // #region agent log
      agentDebugLog({
        sessionId: "2a41e9",
        location: "components/ai-coach.tsx:runDetection",
        message: "live feedback detection path",
        hypothesisId,
        data,
        timestamp: t,
      })
      // #endregion
    }

    // #region agent log
    agentDebugLog({
      sessionId: "2a41e9",
      location: "components/ai-coach.tsx:detecting-effect",
      message: "detecting pose loop mounted",
      hypothesisId: "H4",
      data: { exercise, useCamera, videoRefAtMount: !!videoRef.current, runId: "v3-pose-dep-fix" },
      timestamp: Date.now(),
    })
    // #endregion

    const runDetection = (timestamp: number) => {
      if (!running) return
      animRef.current = requestAnimationFrame(runDetection)
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const video = videoRef.current
      const liveStream = streamRef.current
      if (useCamera && video && liveStream && video.srcObject !== liveStream) {
        video.srcObject = liveStream
        void video.play().catch(() => {})
      }
      const delta = timestamp - lastTime
      const isVideoReady = Boolean(useCamera && video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0)
      const minDelta = isVideoReady ? COACH_FRAME_INTERVAL_MS : 1000 / 60
      if (delta < minDelta) return
      lastTime = timestamp

      let cw = canvas.width || 640
      let ch = canvas.height || 480
      
      // Ensure we have valid canvas size from container if video not ready yet
      if (!isVideoReady && video && useCamera) {
        const container = canvas.parentElement
        if (container) {
          const w = container.clientWidth || 640
          const h = container.clientHeight || 480
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
          }
          cw = canvas.width
          ch = canvas.height
        }
      }
      
      if (isVideoReady && video) {
        // Get actual display dimensions of video element (ensure non-zero for drawing)
        const videoDisplayWidth = Math.max(1, video.clientWidth || video.videoWidth || 640)
        const videoDisplayHeight = Math.max(1, video.clientHeight || video.videoHeight || 480)
        
        // Set canvas internal resolution to match video display (for crisp rendering)
        if (canvas.width !== videoDisplayWidth || canvas.height !== videoDisplayHeight) {
          canvas.width = videoDisplayWidth
          canvas.height = videoDisplayHeight
        }
        
        cw = canvas.width
        ch = canvas.height
        
        const result = detectPose(video, timestamp, { skipHands: true })
        if (result?.landmarks?.length) {
          const lm = result.landmarks as LandmarkPoint[]
          const centered = isInCenter(lm)
          setUserCentered(centered)
          const storedSig = faceSignatureRef.current
          const hasEnrollment = !!storedSig?.length
          const embedVer = faceEmbeddingVersionRef.current
          const meshReady = isFaceLandmarkerReady()
          const useMeshVerify = hasEnrollment && embedVer >= EMBEDDING_VERSION_FACE_MESH && meshReady
          let liveMeshSig: number[] | null = null
          if (useMeshVerify) {
            liveMeshSig = detectFaceSignature(video, timestamp, "match")
          }
          const poseSmooth = faceMatchSmootherRef.current
          const meshSmooth = meshFaceMatchSmootherRef.current
          const match = !hasEnrollment
            ? true
            : embedVer >= EMBEDDING_VERSION_FACE_MESH
              ? !meshReady
                ? true
                : meshSmooth
                  ? meshSmooth(liveMeshSig)
                  : meshEmbeddingMatches(liveMeshSig, storedSig)
              : poseSmooth
                ? poseSmooth(lm, storedSig)
                : faceMatches(lm, storedSig)
          const instantMatch = !hasEnrollment
            ? true
            : embedVer >= EMBEDDING_VERSION_FACE_MESH
              ? !meshReady
                ? true
                : meshEmbeddingMatches(liveMeshSig, storedSig)
              : faceMatches(lm, storedSig)
          setFaceMatch(match)
          const ckOk =
            embedVer >= EMBEDDING_VERSION_FACE_MESH && meshReady
              ? liveMeshSig !== null
              : passesCKFaceFilter(lm)
          const exerciseBodyOk = hasEnoughVisibilityForExercise(result.landmarks, exercise)
          // Face gate: if a face is enrolled, only that face with good visibility can count reps (smoothed match)
          const faceOk = hasEnrollment ? (match && ckOk) : true
          const canCountRep = faceOk && exerciseBodyOk

          const nowTs = Date.now()
          const sessionOngoing = nowTs - detectingStartedAtRef.current > 10_000
          const notInCooldown = fallDismissedAtRef.current === 0 || nowTs - fallDismissedAtRef.current > 90_000
          const fallDetectionActive = sessionOngoing && notInCooldown
          const fallForEnrolledUser = !hasEnrollment || instantMatch
          if (fallDetectionActive && fallForEnrolledUser && detectFall(lm, exercise)) {
            setFallDetected(true)
            playFallAlarm()
          }

          const scan = getBodyScanDetail(result.landmarks)
          if (scan) {
            const readable = scan.summary.replace(/leftArm|rightArm/g, "arms").replace(/leftLeg|rightLeg/g, "legs").replace(/, arms, arms/g, ", arms").replace(/, legs, legs/g, ", legs")
            setBodyScanSummary((prev) => (prev === readable ? prev : readable))
          }
          const env = assessEnvironment(result.landmarks, timestamp, exercise)
          const envUiAt = performance.now()
          const envChanged =
            !envUiCacheRef.current ||
            envUiCacheRef.current.fps !== env.fps ||
            envUiCacheRef.current.fpsLow !== env.fpsLow ||
            envUiCacheRef.current.suggestion !== env.suggestion ||
            envUiCacheRef.current.tooFar !== env.tooFar ||
            envUiCacheRef.current.tooClose !== env.tooClose ||
            Math.round((envUiCacheRef.current.quality ?? 0) * 100) !== Math.round(env.quality * 100)
          if (envChanged && envUiAt - lastEnvUiAtRef.current >= 250) {
            lastEnvUiAtRef.current = envUiAt
            envUiCacheRef.current = env
            setEnvAssessment(env)
          }
          const worldLm = (result.worldLandmarks ?? undefined) as Landmark[] | undefined
          const traceOpts = {
            world: worldLm && worldLm.length >= 33 ? worldLm : undefined,
            trackingQuality: getDetectionQuality(),
          }
          const res = analyzeForm(result.landmarks, exercise, {
            world: traceOpts.world,
            trackingQuality: traceOpts.trackingQuality,
            bodyWeightKg,
            loadKg,
            recentRepScores: repScores,
          })
          const displayRes: FormResult = exerciseBodyOk
            ? res
            : {
                feedback: res.feedback,
                isGoodForm: false,
                score: 0,
                breakdown: [],
                trackingReliability: res.trackingReliability,
              }
          setScore(displayRes.score)
          setBreakdown(displayRes.breakdown)

          // Only require that the relevant body parts are visible; don't double‑gate by generic visibility count
          const enoughVisible = exerciseBodyOk
          const phase = enoughVisible ? getRepPhase(result.landmarks, exercise, false) : "idle"
          if (!enoughVisible) {
            lastPhaseRef.current = "idle"
            phaseBeforeTopStreakRef.current = null
            bottomFrameCountRef.current = 0
            topFrameCountRef.current = 0
          } else if (phase === "top") {
            if (lastPhaseRef.current !== "top") {
              phaseBeforeTopStreakRef.current = lastPhaseRef.current
            }
          } else {
            phaseBeforeTopStreakRef.current = null
          }

          const showGoodForm = goodFormBadge(exercise, phase, displayRes)
          setIsGoodForm(showGoodForm)
          if (showGoodForm !== prevFormGoodRef.current) {
            prevFormGoodRef.current = showGoodForm
            skeletonAnim.onFormChange(showGoodForm, result.landmarks)
          }

          const now = Date.now()

          const W_BOTTOM = 2.1
          const W_MOVE = 1
          const W_TOP = 0.4
          const addRepFormSample = (s: number, weight: number) => {
            if (!canCountRep || weight <= 0) return
            const r = repScoreStatsRef.current
            r.sum += s * weight
            r.w += weight
            r.min = r.min === null ? s : Math.min(r.min, s)
          }
          if (phase === "bottom") {
            bottomFrameCountRef.current += 1
            topFrameCountRef.current = 0
            bottomWasHeldRef.current = bottomFrameCountRef.current >= 1
            addRepFormSample(res.score, W_BOTTOM)
            if (canCountRep && enoughVisible) {
              lastBottomTraceRef.current = captureRepTrace(result.landmarks, exercise, "bottom", traceOpts)
            }
          } else if (phase === "eccentric" || phase === "concentric") {
            addRepFormSample(res.score, W_MOVE)
          } else if (phase === "top") {
            topFrameCountRef.current += 1
            addRepFormSample(res.score, W_TOP)
            if (lastPhaseRef.current === "bottom") {
              bottomWasHeldRef.current = bottomFrameCountRef.current >= 1
            }
            bottomFrameCountRef.current = 0
          } else {
            topFrameCountRef.current = 0
            if (lastPhaseRef.current === "bottom") {
              bottomWasHeldRef.current = bottomFrameCountRef.current >= 1
            }
            bottomFrameCountRef.current = 0
          }

          const isCardio = exercise === "jumping_jacks" || exercise === "high_knees"
          const topHeld = topFrameCountRef.current >= MIN_TOP_FRAMES_FOR_REP
          const priorPhase = phaseBeforeTopStreakRef.current
          const standardRepComplete =
            phase === "top" &&
            (priorPhase === "concentric" || priorPhase === "bottom") &&
            repScoreStatsRef.current.w > 0 &&
            canCountRep &&
            bottomWasHeldRef.current &&
            topHeld
          const cardioRepComplete =
            isCardio &&
            phase === "top" &&
            priorPhase === "bottom" &&
            canCountRep &&
            bottomWasHeldRef.current &&
            topHeld
          const narrowRepFallback =
            !isCardio &&
            phase === "top" &&
            canCountRep &&
            bottomWasHeldRef.current &&
            topHeld &&
            repScoreStatsRef.current.w > 0 &&
            priorPhase === "eccentric"
          const repComplete = standardRepComplete || cardioRepComplete || narrowRepFallback
          if (repComplete && now - lastRepAtRef.current >= 600) {
            lastRepAtRef.current = now
            bottomWasHeldRef.current = false
            phaseBeforeTopStreakRef.current = null
            skeletonAnim.onRepComplete(result.landmarks)
            setRepBounce(true)
            setTimeout(() => setRepBounce(false), 400)
            const topTrace = captureRepTrace(result.landmarks, exercise, "top", traceOpts)
            const bottomTrace = lastBottomTraceRef.current ?? captureRepTrace(result.landmarks, exercise, "bottom", traceOpts)
            repTracesRef.current.push({
              rep: repTracesRef.current.length + 1,
              bottom: bottomTrace,
              top: topTrace,
            })
            clipRecorderRef.current?.markRepBoundary()
            lastBottomTraceRef.current = null
            const st = repScoreStatsRef.current
            const repScore = st.w > 0 ? Math.round(st.sum / st.w) : res.score
            const repScoreForPenalty = st.min ?? res.score

            const usedScore = isCardio ? res.score : repScore
            const pendingScores = [...repScores, usedScore]
            const lw = lastRepScoreWindowRef.current
            lw.push(usedScore)
            if (lw.length > 2) lw.splice(0, lw.length - 2)
            const lowTwice = lw.length === 2 && lw[0]! < 60 && lw[1]! < 60
            const nextRepIdx = repScores.length + 1
            if (
              isCoachMidsetTipsEnabled() &&
              aiTipServerEnabledRef.current &&
              (lowTwice || (nextRepIdx >= 3 && nextRepIdx % 3 === 0))
            ) {
              const nowTip = Date.now()
              const minGap = lowTwice ? 4000 : 35_000
              if (nowTip - lastMidsetTipAtRef.current >= minGap) {
                void (async () => {
                  try {
                    const r = await fetch("/api/ai-coach/tip", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        exerciseId: exercise,
                        exerciseName,
                        repScores: pendingScores.slice(-12),
                        repTraces: repTracesRef.current.slice(-5),
                      }),
                    })
                    const data = (await r.json().catch(() => ({}))) as { tip?: string; error?: string }
                    if (!r.ok || !data.tip?.trim()) return
                    lastMidsetTipAtRef.current = Date.now()
                    speakCoachMidsetTip(data.tip.trim())
                  } catch {
                    /* noop */
                  }
                })()
              }
            }

            setRepScores((prev) => [...prev, isCardio ? res.score : repScore])
            const penaltyThreshold = st.w > 0 ? POSTURE_PENALTY_THRESHOLD : POSTURE_PENALTY_NO_ACCUM_THRESHOLD
            if (!isCardio && repScoreForPenalty < penaltyThreshold) {
              setReps((r) => Math.max(0, r - 1))
              toast.warning("Rep deducted — focus on form")
            } else {
              if (hasEnrollment && canCountRep) faceVerifiedSessionRef.current = true
              hapticRepPulse()
              setReps((r) => {
                const next = r + 1
                if (targetReps > 0 && next >= targetReps && !goalReachedAnnouncedRef.current) {
                  goalReachedAnnouncedRef.current = true
                  setTimeout(() => toast.success("Goal reached!"), 200)
                }
                return next
              })
              repCountForVoiceRef.current += 1
              speakRepComplete(repCountForVoiceRef.current)
            }
            repScoreStatsRef.current = { sum: 0, w: 0, min: null }
          }
          lastPhaseRef.current = phase
          if (displayRes.isGoodForm && now - lastVoiceAtRef.current > 22000 && Math.random() < 0.35) {
            lastVoiceAtRef.current = now
            speakGoodForm()
          }
          skeletonAnim.update(timestamp, result.landmarks, {
            score: displayRes.score,
            isGoodForm: displayRes.isGoodForm,
            phase,
            exercise,
          })
          // Detect form faults for per-segment red highlighting
          const { faults } = detectFaults(
            result.landmarks as unknown as Landmark[],
            exercise,
            displayRes,
            worldLm && worldLm.length >= 33 ? worldLm : undefined
          )
          const faultSegmentPairs = faults.flatMap(f =>
            f.segmentPairs ?? []
          ) as [number, number][]

          const primaryFb =
            res.feedback.map((s) => String(s).trim()).find(Boolean) ?? "Good form."
          let nextLive: string
          if (!exerciseBodyOk) {
            nextLive = "Get your full body in frame so the coach can see you."
          } else if (hasEnrollment && !match) {
            nextLive =
              "Face not recognized — only your enrolled face counts reps. Hold steady for a moment."
          } else if (hasEnrollment && match && !ckOk) {
            nextLive = "Look toward the camera so your face is clearly visible."
          } else if (exerciseBodyOk && faults.length > 0) {
            const worst = faults.find((f) => f.severity === "severe") ?? faults[0]
            nextLive = worst?.cue?.trim() || primaryFb
          } else {
            nextLive = primaryFb
          }
          dbgLiveFbPath("H2", {
            branch: "landmarks",
            exerciseBodyOk,
            nextLivePreview: nextLive.slice(0, 80),
            primaryFbPreview: primaryFb.slice(0, 80),
            faultsLen: faults.length,
            poseReady: poseReadyRef.current,
            runId: "v3-pose-dep-fix",
          })
          commitLiveFeedbackRef.current(nextLive)

          clipRecorderRef.current?.tick(
            video,
            result.landmarks as LandmarkPoint[],
            displayRes.isGoodForm,
            displayRes.score,
            faultSegmentPairs,
          )

          ctx.clearRect(0, 0, cw, ch)
          skeletonAnim.drawScanSweep(ctx, cw, ch, result.landmarks)
          const focused = cueHighlightRef.current
          const overlayFaultSegmentPairs = focused?.kind === "improve" ? focused.segmentPairs : []

          // Ghost rep overlay: draw best-rep skeleton under the live skeleton
          if (ghostEnabled && ghostFrames.length > 0) {
            const t = performance.now()
            const cycleDuration = 3000
            const progress = (t % cycleDuration) / cycleDuration
            const frameIdx = Math.floor(progress * ghostFrames.length)
            const ghostLm = ghostFrames[Math.min(frameIdx, ghostFrames.length - 1)].landmarks
            ctx.save()
            ctx.globalAlpha = 0.35
            drawSkeleton(ctx, ghostLm as Parameters<typeof drawSkeleton>[1], cw, ch, true, {}, 100, [])
            ctx.restore()
          }

          drawSkeleton(ctx, result.landmarks, cw, ch, displayRes.isGoodForm, {
            left: result.leftHandLandmarks,
            right: result.rightHandLandmarks,
          }, displayRes.score, overlayFaultSegmentPairs)
          skeletonAnim.draw(ctx, cw, ch, result.landmarks)

          // Feed replay buffer
          repReplayBufferRef.current.push(result.landmarks as Parameters<typeof drawSkeleton>[1])

          if (focused) {
            drawCueFocusOverlay(ctx, result.landmarks as unknown as Landmark[], focused, cw, ch, a11yPrefs.reduceMotion)
          } else if (exerciseBodyOk && faults.length) {
            renderFaults(ctx, result.landmarks as unknown as Landmark[], faults, {
              width: cw,
              height: ch,
              // Canvas uses CSS scaleX(-1); skeleton uses unmirrored x*width — do not mirror here or fault lines flip wrong side.
              mirror: false,
              pulse: Math.sin(performance.now() / 200) * 0.5 + 0.5,
            })
          }
          return
        } else {
          setBodyScanSummary(null)
          lastPhaseRef.current = "idle"
          phaseBeforeTopStreakRef.current = null
          bottomFrameCountRef.current = 0
          topFrameCountRef.current = 0
          ctx.clearRect(0, 0, cw, ch)
          const feedbackMsg = poseReadyRef.current
            ? "Position yourself in frame to start detection."
            : "Initializing pose detection..."
          dbgLiveFbPath("H3", {
            branch: "video-ready-no-landmarks",
            poseReady: poseReadyRef.current,
            feedbackMsgPreview: feedbackMsg.slice(0, 80),
            runId: "v3-pose-dep-fix",
          })
          commitLiveFeedbackRef.current(feedbackMsg)
          return
        }
      } else if (video && useCamera) {
        // Video not ready yet - just clear canvas
        dbgLiveFbPath("H1", {
          branch: "video-not-ready",
          readyState: video.readyState,
          vw: video.videoWidth,
          vh: video.videoHeight,
          poseReady: poseReadyRef.current,
          runId: "v3-pose-dep-fix",
        })
        commitLiveFeedbackRef.current(
          poseReadyRef.current
            ? "Warming up camera — stay in frame. Coaching cues appear when the preview is ready."
            : "Loading pose model and camera…",
        )
        ctx.clearRect(0, 0, cw, ch)
        return
      }

      // ONLY use simulated mode when camera is NOT available
      if (!useCamera) {
        ctx.clearRect(0, 0, cw, ch)
        simGood = Math.random() > 0.25
        simScore = Math.max(0, Math.min(100, simScore + (simGood ? 1 : -2)))
        setScore(simScore)
        setIsGoodForm(simGood)
        setBreakdown([
          { label: "Knee angle", value: `${70 + Math.floor(Math.random() * 35)}°`, ok: simGood, detail: "Target 70–100°" },
          { label: "Back", value: simGood ? "Neutral" : "Adjust", ok: simGood },
          { label: "Depth", value: simGood ? "Good" : "Higher", ok: simGood },
        ])
        dbgLiveFbPath("H5", { branch: "simulated", simGood, runId: "v3-pose-dep-fix" })
        commitLiveFeedbackRef.current(simGood ? "Looking good. Keep it up." : "Adjust form for better alignment.")
      } else {
        // Camera available but not ready - just clear
        dbgLiveFbPath("H1", { branch: "no-video-ref-but-useCamera", poseReady: poseReadyRef.current, runId: "v3-pose-dep-fix" })
        commitLiveFeedbackRef.current("Connecting to your camera…")
        ctx.clearRect(0, 0, cw, ch)
      }
    }

    animRef.current = requestAnimationFrame(runDetection)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  // Pose readiness uses poseReadyRef inside RAF so we do NOT depend on `poseReady` here (that used to restart the loop and tear down the camera when the model finished loading).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedSpecId, useCamera])

  const coachFocusBar =
    focusMode && onExitFocus ? (
      <div className="sticky top-0 z-40 -mx-4 mb-3 flex justify-center px-4 py-2 border-b border-border bg-background/95 backdrop-blur-md">
        <button
          type="button"
          onClick={onExitFocus}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Exit coach focus
        </button>
      </div>
    ) : null

  if (state === "select") {
    return (
      <>
        {coachFocusBar}
        {coachTrack === "mobility" ? (
          <MobilityCoach onBack={() => setCoachTrack("strength")} />
        ) : (
      <div data-testid="screen-ai-coach" className="flex min-h-dvh flex-col" style={{ backgroundColor: CHROME.black }}>
        <ChromeHeader />
        {/* Coach hero */}
        <div className="relative overflow-hidden px-5 pb-5 pt-4" style={{ backgroundColor: CHROME.black }}>
          <HeroAccentLines height={120} strokeColor={CHROME.border} />
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.muted }}>AI Coach</p>
            <h1 className="text-4xl font-black uppercase leading-none text-white" style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}>
              {coachPickerStep === "families" ? "Choose movement" : "Pick variation"}
            </h1>
            <p className="mt-1 text-xs" style={{ color: CHROME.muted }}>{t("coach.privacyBanner")}</p>
          </div>
        </div>
        {/* Track toggles */}
        <div className="flex gap-2 px-4 pb-3 pt-1">
          {(["strength", "mobility"] as const).map((track) => (
            <button
              key={track}
              type="button"
              onClick={() => setCoachTrack(track)}
              className="flex-1 rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors"
              style={
                coachTrack === track
                  ? { backgroundColor: CHROME.orange, color: CHROME.white }
                  : { backgroundColor: CHROME.focusBg, color: CHROME.muted, border: `1px solid ${CHROME.border}` }
              }
            >
              {track}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 px-4 pb-28">
        <AnimatePresence mode="wait">
        {coachPickerStep === "variants" ? (
          <motion.div
            key="variants-wrap"
            className="flex w-full flex-col gap-3"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={handlePickerBackToFamilies}
              className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              All movements
            </button>
            <motion.div
              key="variants-grid"
              className="flex flex-col gap-2"
              variants={staggerChildren(0.06, 0.05)}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            >
              {activePickerVariants.map((v) => {
                const variantTitle =
                  v.specId === "deadlift" ? t("coach.deadlift.name") : v.specId === "rdl" ? t("coach.rdl.name") : v.name
                return (
                  <motion.button
                    key={v.specId}
                    variants={CINEMATIC.statReveal}
                    type="button"
                    onClick={() => handleSelectVariant(v.specId)}
                    className="group relative flex min-h-[72px] items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.99] focus-visible:outline-none"
                    style={{ backgroundColor: CHROME.cardBg, border: `1px solid ${CHROME.border}` }}
                  >
                    <div className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: CHROME.orange }} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-heading)" }}>
                        {variantTitle}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: CHROME.muted }}>{v.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4" style={{ color: CHROME.muted }} />
                  </motion.button>
                )
              })}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="families-grid"
            className="flex flex-col gap-3"
            variants={staggerChildren(0.04, 0.05)}
            initial={reduceMotion ? false : "hidden"}
            animate="show"
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          >
            {/* Custom exercise button — full width */}
            <button
              type="button"
              onClick={() => setCustomBuilderOpen(true)}
              className="flex min-h-[56px] items-center gap-3 rounded-xl border border-primary/35 bg-card px-4 py-3 text-left text-sm font-semibold text-primary transition-colors hover:border-primary/60"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="flex-1">Create custom exercise</span>
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* 2-column graphical exercise cards */}
            <div className="grid grid-cols-2 gap-2">
              {pickerFamilies.map((fam, i) => {
                const illustId: ExerciseIllustrationId = FAMILY_TO_ILLUSTRATION[fam.id] ?? "default"
                return (
                  <motion.button
                    key={fam.id}
                    variants={CINEMATIC.statReveal}
                    type="button"
                    onClick={() => handleSelectFamily(fam.id)}
                    className={`group relative flex min-h-[120px] flex-col items-start justify-between overflow-hidden rounded-2xl border bg-card px-3 pb-3 pt-2 text-left transition-colors hover:border-primary/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary border-border`}
                    style={{ animationDelay: `${i * 0.04}s` }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {/* Tone gradient background */}
                    <div
                      className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br ${fam.gradient} opacity-60`}
                      aria-hidden
                    />
                    {/* Animated illustration in corner */}
                    <div className="pointer-events-none absolute right-1 top-1 opacity-40">
                      <ExerciseIllustration id={illustId} size={64} animate={!reduceMotion} />
                    </div>
                    <div className="relative z-10 flex-1">
                      <h3
                        className="text-sm font-bold leading-tight text-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {fam.name}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{fam.description}</p>
                    </div>
                    <div className="relative z-10 flex w-full items-center justify-between">
                      <span className="inline-block rounded-sm bg-foreground/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        {fam.category}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
        </div>
        </div>
        )}
      </>
    )
  }

  if (state === "setup") {
    const tips = resolvedExerciseTips
    const memoryTip = exerciseName ? getCoachMemoryTip(exerciseName) : null
    const culturalExtras = selectedSpecId ? getCulturalTipExtras(locale, selectedSpecId) : []
    const spec = selectedSpecId ? coachLoadSpec(selectedSpecId) : null
    const showLoadChip = spec?.loadType === "external"
    return (
      <>
        {coachFocusBar}
      <div className="flex flex-col items-center gap-6 px-4 pt-8 pb-28">
        <button
          type="button"
          onClick={handleSetupBack}
          className="self-start flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back
        </button>
        <CinematicStage
          className="w-full max-w-sm rounded-3xl border border-border/70 p-5"
          brandMark={<FittrackLogoMark size={30} animated />}
        >
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {exerciseName || "Exercise"}
          </h2>
          {catalogCtx?.variant.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{catalogCtx.variant.description}</p>
          ) : null}
          {catalogCtx?.variant.cameraNote ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">Camera:</span> {catalogCtx.variant.cameraNote}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            Position your full body in the camera frame. Stand 6–8 ft away for best detection.
          </p>
        </CinematicStage>
        {showLoadChip && selectedSpecId && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-typo-eyebrow font-semibold uppercase tracking-wide text-muted-foreground">Set load</span>
            <LoadChip
              exerciseId={selectedSpecId}
              unit={weightUnitPref}
              value={loadKg}
              onChange={setLoadKg}
            />
          </div>
        )}
        <div className="w-full max-w-sm space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Form tips for this exercise
          </h3>
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-card p-3 border border-border">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">{tip}</span>
            </div>
          ))}
          {culturalExtras.map((tip, i) => (
            <div key={`c-${i}`} className="flex items-start gap-3 rounded-xl bg-primary/5 p-3 border border-primary/20">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">{tip}</span>
            </div>
          ))}
          {memoryTip && (
            <div className="flex items-start gap-3 rounded-xl bg-chart-2/10 p-3 border border-chart-2/25">
              <Zap className="h-4 w-4 text-chart-2 shrink-0 mt-0.5" />
              <div>
                <span className="text-typo-eyebrow font-semibold uppercase text-chart-2">From your last sessions</span>
                <p className="text-sm text-foreground mt-0.5">{memoryTip}</p>
              </div>
            </div>
          )}
        </div>
        <div className="w-full max-w-sm rounded-xl bg-card p-3 border border-border space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Columns2 className="h-4 w-4 text-primary" />
            Ghost rep overlay
          </h3>
          <p className="text-xs text-muted-foreground">
            Shows your best verified rep as a semi-transparent skeleton on the live camera — train against your own personal best form.
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Enable ghost rep</span>
            <Switch
              checked={ghostEnabled}
              onCheckedChange={setGhostEnabled}
              aria-label="Ghost rep overlay"
            />
          </div>
        </div>

        <div className="w-full max-w-sm rounded-xl bg-card p-3 border border-border space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Coach accessibility</h3>
          <p className="text-xs text-muted-foreground -mt-2">Saved on this device only.</p>
          {(
            [
              ["hapticOnRep", "Haptic on rep", "Short vibration when a rep counts"] as const,
              ["announceReps", "Announce reps", "Speak rep milestones out loud"] as const,
              ["reduceMotion", "Reduce motion", "Lighter skeleton and UI motion"] as const,
              ["highContrastVideo", "High-contrast video", "Boost camera contrast while detecting"] as const,
            ] as const
          ).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={a11yPrefs[key]}
                onCheckedChange={(v) => applyA11yPrefs({ [key]: v })}
                aria-label={label}
              />
            </div>
          ))}
        </div>
        <div className="w-full max-w-sm rounded-xl bg-card p-3 border border-border space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Rep goal (optional)
          </h3>
          <p className="text-xs text-muted-foreground">
            Set a target number of reps. Leave 0 for no goal.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={999}
              value={targetReps || ""}
              onChange={(e) => setTargetReps(Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0)))}
              placeholder="0"
              className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Target reps"
            />
            <span className="text-sm text-muted-foreground">reps</span>
          </div>
        </div>
        <div className="w-full max-w-sm rounded-xl bg-card p-3 border border-border space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            One account, one face
          </h3>
          <p className="text-xs text-muted-foreground">
            Enroll your face so only your reps count. Stay centered in frame; wrong posture reduces rep by 1.
          </p>
          {faceEnrolled ? (
            <p className="text-xs text-primary font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Face enrolled — only your reps will count
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setState("enrolling")}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              <UserCheck className="h-4 w-4" />
              Enroll your face
            </button>
          )}
        </div>
        <button
          onClick={handleStartDetection}
          className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-semibold text-primary-foreground text-base transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          <Play className="h-5 w-5" fill="currentColor" />
          Start Detection
        </button>
      </div>
      </>
    )
  }

  if (state === "enrolling") {
    return (
      <>
        {coachFocusBar}
      <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24">
        <div className="relative h-[78vh] min-h-[450px] max-h-[85vh] bg-secondary overflow-hidden rounded-lg border-2 border-primary mx-2 mt-2">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover z-0"
            playsInline
            muted
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ transform: "scaleX(-1)", zIndex: 10 }} aria-hidden />
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/40">
            <UserCheck className="h-16 w-16 text-primary mb-4" />
            <p className="text-lg font-semibold text-white text-center px-4">Hold still — capturing your face</p>
            <p className="text-sm text-white/90 mt-2 text-center px-4 font-medium">
              {enrollProgress > 0
                ? `Stable frames: ${enrollProgress} / ${FACE_ENROLL_STABLE_FRAMES}`
                : "Position your face in frame"}
            </p>
            <p className="text-sm text-white/80 mt-1 text-center px-4">Keep your face clearly visible. Stored on this device only (see Profile).</p>
          </div>
        </div>
        <button onClick={() => setState("setup")} className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Cancel
        </button>
      </div>
      </>
    )
  }

  if (state === "detecting") {
    return (
      <>
        {coachFocusBar}
        <CueFocusProvider
          exerciseId={selectedSpecId ?? "unknown"}
          breakdown={breakdown}
          onHighlightChange={setCueHighlight}
        >
      <div className="flex min-h-[calc(100vh-80px)] flex-col pb-24 lg:flex-row lg:items-start lg:gap-4 lg:px-3 lg:pt-2">
        <div className="surface-stage-gradient relative mx-2 mt-2 h-[78vh] min-h-[450px] max-h-[85vh] min-w-0 flex-1 overflow-hidden rounded-2xl border border-[color:var(--surface-stage-hairline)] bg-[color:var(--surface-stage)] lg:mx-0 lg:mt-0">
          {useCamera && (
            <video
              ref={videoRef}
              className="absolute inset-0 z-0 h-full w-full object-cover mirror"
              playsInline
              muted
              style={{
                transform: "scaleX(-1)",
                ...(a11yPrefs.highContrastVideo ? { filter: "contrast(1.22) brightness(1.06)" } : {}),
              }}
            />
          )}
          {!useCamera && (
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-secondary to-background">
              <Camera className="h-20 w-20 text-muted-foreground/40" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)", zIndex: 10 }}
            aria-label="Skeleton overlay"
          />
          {useCamera && faceEnrolled && !a11yPrefs.reduceMotion && (
            <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden" aria-hidden>
              <div className="coach-face-scan-line absolute left-0 right-0 top-0 h-14 bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
            </div>
          )}
          {fallDetected && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/85 p-6 backdrop-blur-sm">
              <div className="max-w-sm rounded-2xl border-2 border-destructive bg-destructive/20 p-6 text-center">
                <p className="text-xl font-bold text-destructive">Possible fall detected</p>
                <p className="mt-2 text-sm text-white/90">If you need help, call emergency services.</p>
              </div>
              <div className="flex w-full max-w-xs flex-col gap-3 sm:flex-row">
                <a
                  href={`tel:${EMERGENCY_NUMBER}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-6 py-4 font-semibold text-destructive-foreground hover:bg-destructive/90"
                >
                  <Phone className="h-5 w-5" />
                  Call {EMERGENCY_NUMBER}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setFallDetected(false)
                    stopFallAlarm()
                    fallDismissedAtRef.current = Date.now()
                  }}
                  className="rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  I&apos;m OK
                </button>
              </div>
            </div>
          )}
          <div
            className={`absolute top-3 left-3 z-20 flex items-center gap-2 rounded-2xl border px-3 py-2 shadow-lg backdrop-blur-md transition-all duration-300 ${
              isGoodForm
                ? "border-primary bg-primary text-primary-foreground"
                : "border-destructive bg-black/80 text-destructive"
            }`}
          >
            {isGoodForm ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-foreground" /> : <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
            <span className="text-typo-eyebrow font-bold uppercase tracking-[0.2em]">{isGoodForm ? "Good form" : "Adjust form"}</span>
          </div>
          <div className="absolute top-3 right-3 z-20 w-[min(calc(100%-7rem),15.5rem)]">
            <div
              className={`overflow-hidden rounded-2xl border border-white/25 bg-black/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md ${
                repBounce && !a11yPrefs.reduceMotion ? "motion-safe:animate-rep-bounce" : ""
              }`}
            >
              <div className="px-3 py-2.5 sm:px-3.5">
                <p className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-white/50">
                  {targetReps > 0 ? "Reps · goal" : "Reps"}
                </p>
                {targetReps > 0 ? (
                  <div className="mt-1 flex items-center gap-3">
                    <RingGauge
                      value={reps}
                      max={targetReps}
                      size={76}
                      thickness={6}
                      spring
                      progressClassName="stroke-white"
                      trackClassName="stroke-white/15"
                    >
                      <span
                        className="text-2xl font-bold tabular-nums leading-none text-white"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {reps}
                      </span>
                      <span className="text-typo-micro font-semibold uppercase tracking-wider text-white/45">/ {targetReps}</span>
                    </RingGauge>
                    {reps >= targetReps && (
                      <span className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-primary">Goal reached</span>
                    )}
                  </div>
                ) : (
                  <p
                    className="mt-0.5 text-4xl font-bold tabular-nums leading-none text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {reps}
                  </p>
                )}
              </div>
              {useCamera && (
                <div className="flex flex-wrap gap-1.5 border-t border-white/10 bg-black/25 px-2.5 py-2 sm:px-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-typo-eyebrow font-bold uppercase tracking-[0.18em] ${
                      userCentered ? "bg-primary/20 text-primary" : "bg-destructive/25 text-destructive"
                    }`}
                    title={userCentered ? "You're in the center zone" : "Move into the dashed box"}
                  >
                    <Crosshair className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                    {userCentered ? "Centered" : "Recenter"}
                  </span>
                  {faceEnrolled && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-typo-eyebrow font-bold uppercase tracking-[0.18em] motion-reduce:animate-none ${
                        faceMatch ? "bg-primary/20 text-primary" : "bg-destructive/25 text-destructive motion-safe:animate-pulse"
                      }`}
                      title={faceMatch ? "Your face — reps count" : "Checking face — hold steady if this is you"}
                    >
                      <User className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                      {faceMatch ? "Verified" : "Face check"}
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-typo-eyebrow font-semibold text-sky-100"
                    title="Alarm and emergency call if a fall is detected"
                  >
                    <Shield className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                    Fall guard
                  </span>
                </div>
              )}
            </div>
          </div>
          {!useCamera && (
            <div className="absolute bottom-4 left-4 right-4 z-[600] rounded-xl bg-chart-4/90 backdrop-blur-sm px-4 py-2.5 border border-chart-4/50">
              <p className="text-xs font-medium text-foreground">
                Simulated mode — camera denied or unavailable. Rep counting and form feedback still work.
              </p>
            </div>
          )}
          {!isGoodForm && coachLivePrimary ? (
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[25] rounded-2xl border border-primary/45 bg-black/80 px-4 py-3 shadow-[0_12px_40px_-16px_oklch(0_0_0/0.75)] backdrop-blur-md motion-safe:backdrop-blur-lg">
              <p className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-primary">Form cue</p>
              <p className="mt-1 text-sm font-medium leading-snug text-[color:var(--surface-stage-fg)] motion-safe:blur-[0.2px]">
                {coachLivePrimary}
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex w-full flex-col space-y-4 px-4 pt-4 lg:max-h-[min(85vh,calc(100vh-7rem))] lg:w-[min(100%,340px)] lg:shrink-0 lg:overflow-y-auto lg:py-2 lg:pl-2 lg:pr-4 lg:pt-2">
          {useCamera && (
            <div className="rounded-2xl border border-amber-500/20 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                  <Camera className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  {envAssessment?.suggestion ? (
                    <p className="text-sm font-medium text-foreground">{envAssessment.suggestion}</p>
                  ) : (
                    <p className="text-sm font-medium text-foreground">
                      For best detection, keep <strong className="text-amber-600 dark:text-amber-400">3–4 feet</strong> between you and the camera.
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Stay in the <strong className="text-foreground">center</strong> (dashed box) for rep counting. Full body in frame = better detection.
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {useCamera && (
                      <span
                        className={`text-typo-caption font-semibold ${
                          poseReady ? "text-emerald-600 dark:text-emerald-400/80" : "text-amber-600 dark:text-amber-400/80"
                        }`}
                      >
                        Pose: {poseReady ? "tracking" : "searching"}
                      </span>
                    )}
                    {bodyScanSummary && (
                      <span className="text-typo-caption text-emerald-600 dark:text-emerald-400">
                        Body: {bodyScanSummary}
                      </span>
                    )}
                    {envAssessment && (
                      <>
                        <span className={`text-typo-caption ${envAssessment.fpsLow ? "text-destructive" : "text-emerald-600 dark:text-emerald-400/80"}`}>
                          {envAssessment.fps} fps
                        </span>
                        <span
                          className={`text-typo-caption ${
                            envAssessment.quality > 0.6
                              ? "text-emerald-600 dark:text-emerald-400/80"
                              : envAssessment.quality > 0.3
                                ? "text-amber-600 dark:text-amber-400/80"
                                : "text-destructive/90"
                          }`}
                        >
                          Quality: {Math.round(envAssessment.quality * 100)}%
                        </span>
                        {envAssessment.cameraAngle !== "unknown" && (
                          <span
                            className={`text-typo-caption ${
                              envAssessment.angleRecommended ? "text-emerald-600 dark:text-emerald-400/80" : "text-amber-600 dark:text-amber-400/80"
                            }`}
                          >
                            {envAssessment.cameraAngle} view{envAssessment.angleRecommended ? "" : " (try another angle)"}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-stretch gap-4 rounded-2xl border border-border bg-gradient-to-br from-card to-card/80 p-4 shadow-sm">
            <RingGauge
              value={score}
              max={100}
              size={88}
              thickness={7}
              spring
              progressClassName="stroke-metric-coach"
              trackClassName="stroke-muted/40"
            >
              <span
                className="text-[26px] font-bold tabular-nums leading-none text-foreground animate-score-roll"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {score}
              </span>
              <span className="text-typo-micro font-bold uppercase tracking-[0.22em] text-metric-coach/90">
                Form
              </span>
            </RingGauge>
            <div className="min-w-0 flex-1 flex flex-col justify-center space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-muted-foreground">Live score</p>
                  <p className="text-xs text-muted-foreground mt-0.5">From your live form cues</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-typo-eyebrow font-bold tabular-nums ${
                    isGoodForm
                      ? "border-metric-move/30 bg-metric-move/10 text-metric-move"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {isGoodForm ? "On target" : "Adjust"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden ring-1 ring-border/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-metric-coach/90 to-metric-coach transition-[width] duration-500 ease-out"
                  style={{ width: `${score}%` }}
                />
              </div>
              {envAssessment && (
                <div className="flex items-center gap-2 text-typo-eyebrow text-muted-foreground">
                  <svg width="24" height="14" viewBox="0 0 24 14" className="shrink-0 opacity-80">
                    <path
                      d="M 2 12 A 10 10 0 0 1 22 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-secondary"
                    />
                    <path
                      d="M 2 12 A 10 10 0 0 1 22 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${Math.round(envAssessment.quality * 31.4)} 31.4`}
                      className={envAssessment.quality > 0.6 ? "text-metric-move" : envAssessment.quality > 0.3 ? "text-metric-streak" : "text-destructive"}
                      style={{ transition: "stroke-dasharray 0.5s ease-out" }}
                    />
                  </svg>
                  Detection quality
                </div>
              )}
            </div>
          </div>
          {breakdown.length > 0 && (
            <div className="rounded-xl bg-card p-3 border border-border">
              <div className="text-xs font-semibold text-foreground mb-2">Live form breakdown</div>
              <div className="flex flex-wrap gap-2">
                {breakdown.map((b, i) => (
                  <span key={i} title={b.detail} className="inline-flex">
                    <InteractiveCue
                      text={`${b.label} ${b.value}`}
                      kind={b.ok ? "good" : "improve"}
                      className={`mx-0 rounded-lg px-2.5 py-1.5 text-typo-eyebrow font-medium transition-colors duration-300 ${
                        b.ok ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                      }`}
                    />
                  </span>
                ))}
              </div>
            </div>
          )}
          <div
            className="rounded-xl border border-border bg-card p-4"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-labelledby="coach-live-overlay-label"
          >
            <span id="coach-live-overlay-label" className="sr-only">
              Live feedback
            </span>
            <div className="mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-sm font-semibold text-foreground">Live feedback</span>
            </div>
            <p key={coachLivePrimary} className="text-base font-medium leading-snug text-foreground min-h-[2.5rem]">
              {coachLivePrimary}
            </p>
            {coachLiveBreakdownHints.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-border pt-2">
                {coachLiveBreakdownHints.map((b, i) => (
                  <InteractiveCue
                    key={`${b.label}-${i}`}
                    as="li"
                    kind="improve"
                    text={`${b.label}: ${b.value}${b.detail ? ` — ${b.detail}` : ""}`}
                    className="text-sm text-destructive mx-0"
                  />
                ))}
              </ul>
            ) : null}
            {envAssessment?.fpsLow ? (
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                Low frame rate — move closer, add light, or close other apps for clearer cues.
              </p>
            ) : null}
            {bodyScanSummary && !/leg|ankle|knee|foot|arm/i.test(bodyScanSummary) ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Step back so your <strong className="text-foreground">full body</strong> (hips, knees, feet) is in frame — partial
                body limits form scoring and rep counting.
              </p>
            ) : null}
            {coachSetupTips.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                {coachSetupTips.map((tip) => (
                  <li key={tip} className="text-xs text-muted-foreground leading-snug">
                    • {tip}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {selectedSpecId && (
            <AICoachLlmPanel
              exerciseId={selectedSpecId}
              exerciseName={exerciseName}
              reps={reps}
              score={Math.round(score)}
              repScores={repScores}
              feedback={feedback}
              breakdown={breakdown}
              exerciseTips={resolvedExerciseTips}
              sessionDnaSummary={null}
              repScoreStats={
                repScores.length
                  ? {
                      min: Math.min(...repScores),
                      max: Math.max(...repScores),
                      avg: Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length),
                    }
                  : null
              }
              liveCue={coachLivePrimary}
              sessionPhase="live"
            />
          )}
          <button
            onClick={handleFinish}
            className="w-full rounded-xl bg-primary py-4 text-center font-semibold text-primary-foreground text-base transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            End session
          </button>
        </div>
      </div>
        </CueFocusProvider>
      </>
    )
  }

  const avgRepScore = sessionFormScore(repScores, score)
  const effLine =
    sessionDna != null
      ? `${sessionDna.effectiveReps.toFixed(1)} effective reps${sessionDna.verifiedMovement ? " · Verified" : ""}`
      : null
  const traceCues = aggregateTopFaults(repTracesRef.current, 4)
  const recapCues = traceCues.length
    ? traceCues
    : topCuesFromBreakdown(recapBreakdown.length ? recapBreakdown : breakdown, feedback, 4)
  const finalScore = sessionDna?.score ?? avgRepScore

  return (
    <>
      {coachFocusBar}
    <div className="flex flex-col items-center gap-6 px-4 pt-8 pb-28">
      {/* Animated success check mark */}
      <motion.div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 shadow-[0_0_32px_oklch(0.72_0.22_130/0.3)]"
        initial={reduceMotion ? false : { scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
      >
        <svg viewBox="0 0 48 48" width={44} height={44} fill="none" aria-hidden>
          <motion.circle cx="24" cy="24" r="20" stroke="var(--primary)" strokeWidth="3"
            initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <motion.path d="M14 24 L21 31 L34 17" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
          />
        </svg>
      </motion.div>

      {/* Cascading headline */}
      <div className="text-center space-y-1">
        <motion.h2
          className="text-2xl font-black text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          Workout Complete 💪
        </motion.h2>
        <motion.p
          className="text-sm text-muted-foreground"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {reps} reps · {exerciseName}
          {effLine ? ` · ${effLine}` : ""}
        </motion.p>
        <p className="mx-auto max-w-sm pt-1 text-[11px] leading-snug text-muted-foreground">
          <strong className="font-semibold text-foreground/80">Replay set</strong> and the saved video only appear after you finish with{" "}
          <strong className="font-semibold text-foreground/80">at least one rep</strong>, camera preview on, and{" "}
          <strong className="font-semibold text-foreground/80">Record coach set clips</strong> enabled in Profile → Settings.
        </p>
      </div>

      {recapIsPr ? (
        <MotionCelebrate className="w-full max-w-sm">
          <div className="rounded-2xl border border-primary/35 bg-primary/15 px-4 py-2.5 text-center text-sm font-bold uppercase tracking-[0.2em] text-primary">
            Personal record
          </div>
        </MotionCelebrate>
      ) : null}

      {/* Counting form score ring */}
      <motion.div
        className="relative flex items-center justify-center"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6, type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <ParticleBurst trigger={sessionCelebrateBurst && finalScore >= 90} count={60} size={240} />
        </div>
        <svg width="160" height="160" viewBox="0 0 144 144" aria-hidden className="absolute inset-0">
          <circle cx="72" cy="72" r="64" fill="none" stroke="var(--secondary)" strokeWidth="8" />
          <motion.circle
            cx="72" cy="72" r="64" fill="none"
            stroke="var(--primary)" strokeWidth="8" strokeLinecap="round"
            transform="rotate(-90 72 72)"
            initial={{ strokeDasharray: "0 402" }}
            animate={{ strokeDasharray: `${(finalScore / 100) * 402} 402` }}
            transition={{ duration: 1.2, delay: 0.7, ease: "easeOut" }}
          />
        </svg>
        <div className="relative flex h-40 w-40 flex-col items-center justify-center text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">FORM SCORE</p>
          <p className="text-4xl font-black tabular-nums text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            <AnimatedCounter value={finalScore} duration={1.2} />
            <span className="text-xl font-bold text-muted-foreground">%</span>
          </p>
        </div>
      </motion.div>

      <CueFocusProvider exerciseId={selectedSpecId ?? "unknown"} breakdown={recapBreakdown.length ? recapBreakdown : breakdown}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-[1.35rem] border border-[color:var(--surface-stage-hairline)] bg-[color:var(--surface-stage)] px-5 py-10 shadow-xl">
        {sessionCelebrateBurst ? <CelebrationBurst className="-translate-y-4" /> : null}
        <StatDisplay tone="stage" eyebrow="Form score" value={sessionDna?.score ?? avgRepScore} unit="%" size="lg" />
        {recapCues.length > 0 ? (
          <div className="mt-8 space-y-3 border-t border-white/10 pt-8">
            <p className="text-typo-eyebrow font-bold uppercase tracking-[0.24em] text-white/50">Coach verdict</p>
            <ul className="space-y-3">
              {recapCues.slice(0, 3).map((cue, idx) => (
                <li key={idx} className="flex gap-2 text-base font-medium leading-snug text-[color:var(--surface-stage-fg)]">
                  <Target className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden />
                  <InteractiveCue text={cue} kind="improve" className="mx-0 p-0 text-base font-medium leading-snug text-[color:var(--surface-stage-fg)]" />
                </li>
              ))}
            </ul>
            <p className="text-typo-caption text-white/45">
              Open the assistant below—your session DNA and these cues ship as context.
            </p>
          </div>
        ) : null}
      </div>

      {sessionDna != null ? (
        <SessionDnaCard {...sessionDna} ringSize={120} className="w-full max-w-sm border-primary/25 shadow-lg" />
      ) : (
        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 144 144" aria-hidden>
            <circle cx="72" cy="72" r="64" fill="none" stroke="var(--secondary)" strokeWidth="8" />
            <circle
              cx="72"
              cy="72"
              r="64"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 402} 402`}
              transform="rotate(-90 72 72)"
            />
          </svg>
          <div className="text-center">
            <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              {score}%
            </span>
            <span className="block text-xs text-muted-foreground">Form Score</span>
          </div>
        </div>
      )}
      {repScores.length > 0 && (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <CoachRepTimeline
            repScores={repScores}
            selectedRep={selectedRecapRep}
            onRepSelect={(i) => setSelectedRecapRep(i)}
            label="Set recap · tap a rep"
            repTraces={repTracesRef.current.length ? repTracesRef.current : undefined}
          />
        </div>
      )}
      {selectedSpecId ? (
        <div className="w-full max-w-sm">
          <ExerciseBodyPreview exerciseId={selectedSpecId} autoEnable />
        </div>
      ) : null}
      </CueFocusProvider>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-3">
          <StatDisplay size="md" eyebrow="Total reps" value={reps} />
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <StatDisplay size="md" eyebrow="Avg rep quality" value={`${avgRepScore}%`} />
        </div>
        {repScores.length > 0 && (
          <>
            <div className="rounded-xl border border-border bg-card p-3">
              <StatDisplay size="md" eyebrow="Best rep" value={`${Math.max(...repScores)}%`} />
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <StatDisplay size="md" eyebrow="High-form reps" value={repScores.filter((s) => s >= 80).length} />
            </div>
          </>
        )}
      </div>
      {sessionDna != null ? (
        <CoachFinishShareBar
          savedSessionId={finishShareSessionId}
          pngPayload={{
            exercise: sessionDna.exercise,
            reps: sessionDna.reps,
            score: sessionDna.score,
            effectiveReps: sessionDna.effectiveReps,
            repScores: sessionDna.repScores,
            verifiedMovement: sessionDna.verifiedMovement,
            faceVerifiedSession: sessionDna.faceVerifiedSession,
            topFaults: aggregateTopFaults(repTracesRef.current, 3),
          }}
          onRequestAiReview={
            replayTarget.sessionId || replayTarget.clipId ? () => setReplayOpen(true) : undefined
          }
        />
      ) : null}
      {guestMode && sessionDna != null && reps > 0 ? (
        <Alert className="w-full max-w-sm border-primary/35 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" aria-hidden />
          <AlertTitle>Save Session DNA</AlertTitle>
          <AlertDescription className="grid gap-3">
            <p className="text-sm leading-snug">
              Sessions stay on-device as a guest — sign up to persist proof in the cloud, share Session DNA cards, and run cross-device
              Arena duels.
            </p>
            {onRequestSignIn ? (
              <Button type="button" className="w-full" size="sm" onClick={() => onRequestSignIn()}>
                Create free account / Sign in
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {sessionDna != null && onNavigate ? (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <p className="text-center text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-muted-foreground">
            What&apos;s next
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!(replayTarget.sessionId || replayTarget.clipId)}
              onClick={() => setReplayOpen(true)}
              title={
                replayTarget.sessionId || replayTarget.clipId
                  ? "Open clip & optional AI frame review"
                  : "Replay needs a locally saved clip."
              }
              className={`flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center text-typo-eyebrow font-bold uppercase leading-tight tracking-tight transition-colors disabled:opacity-45 ${
                replayTarget.sessionId || replayTarget.clipId
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-border bg-secondary/35 text-muted-foreground"
              }`}
            >
              <Play className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-[0.62rem] sm:text-[0.65rem]">Replay</span>
            </button>
            <button
              type="button"
              onClick={() => void handleOpenCompareSheet()}
              disabled={sessionDna == null}
              className="flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl border border-border bg-secondary/55 px-2 py-2 text-center text-typo-eyebrow font-bold uppercase leading-tight tracking-tight transition-colors hover:bg-secondary/75 disabled:opacity-45 dark:border-white/10"
              title="Same-movement deltas vs your last saved session"
            >
              <Columns2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-[0.62rem] sm:text-[0.65rem]">Compare</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenArenaFromRecap()}
              title="Opens Arena prefilled with this lift"
              className="flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl border border-metric-streak/45 bg-metric-streak/10 px-2 py-2 text-center text-typo-eyebrow font-bold uppercase leading-tight tracking-tight transition-colors hover:bg-metric-streak/15 dark:border-white/10"
            >
              <Swords className="h-4 w-4 shrink-0 text-metric-streak" aria-hidden />
              <span className="text-[0.62rem] sm:text-[0.65rem] text-foreground">Duel</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Home &amp; wearable vitals →
          </button>
          {replayTarget.sessionId || replayTarget.clipId ? (
            <p className="px-1 text-center text-[11px] leading-snug text-muted-foreground">
              Inside Replay ·{" "}
              <strong className="font-semibold text-foreground/90">Get AI review</strong> pulls key poses (needs{" "}
              <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> server-side).
            </p>
          ) : null}
        </div>
      ) : null}
      {sessionDna != null && !(replayTarget.sessionId || replayTarget.clipId) ? (
        <p className="w-full max-w-sm text-center text-[11px] leading-snug text-muted-foreground px-2">
          {isCoachReplayLocalEnabled() ? (
            <>
              {t("coach.noReplayClipBody")}{" "}
              <Link
                href="/privacy#coach-replay-and-ai"
                className="font-semibold text-foreground/90 underline underline-offset-2 hover:text-foreground"
              >
                {t("coach.recapReplayPrivacyLink")}
              </Link>
              .
            </>
          ) : (
            <>
              Turn on <strong className="font-semibold">Record coach set clips</strong> under Profile → Settings to save your set video for replay and AI review.
            </>
          )}
        </p>
      ) : null}
      {sessionDna == null && !(replayTarget.sessionId || replayTarget.clipId) ? (
        <p className="w-full max-w-sm text-center text-[11px] leading-snug text-amber-700 dark:text-amber-300/90 px-2 rounded-lg border border-amber-500/25 bg-amber-500/10 py-2">
          This recap has <strong className="font-semibold">0 reps</strong>, so nothing was saved and there is no replay clip. Start again, complete reps while the camera is on, then tap <strong className="font-semibold">End session</strong> —{" "}
          <strong className="font-semibold">Replay set</strong> shows up when a clip was recorded.
        </p>
      ) : null}
      <div className="w-full max-w-sm space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Coach feedback</h3>
        {feedback.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl bg-card p-3 border border-border">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">{item}</span>
          </div>
        ))}
      </div>
      {selectedSpecId && (
        <AICoachLlmPanel
          exerciseId={selectedSpecId}
          exerciseName={exerciseName}
          reps={reps}
          score={Math.round(score)}
          repScores={repScores}
          feedback={feedback}
          breakdown={recapBreakdown.length ? recapBreakdown : breakdown}
          exerciseTips={resolvedExerciseTips}
          sessionDnaSummary={
            sessionDna
              ? {
                  effectiveReps: sessionDna.effectiveReps,
                  verifiedMovement: sessionDna.verifiedMovement,
                  faceVerifiedSession: sessionDna.faceVerifiedSession,
                }
              : null
          }
          repScoreStats={
            repScores.length
              ? {
                  min: Math.min(...repScores),
                  max: Math.max(...repScores),
                  avg: Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length),
                }
              : null
          }
          sessionPhase="completed"
        />
      )}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={() => {
            void clipRecorderRef.current?.stop?.().catch(() => {})
            clipRecorderRef.current = null
            activeClipIdRef.current = null
            setReplayOpen(false)
            setReplayTarget({ sessionId: null, clipId: null })
            setCompareOpen(false)
            setCompareBaseline(null)
            setCompareCurrent(null)
            setSessionDna(null)
            setRecapIsPr(false)
            setFinishShareSessionId(null)
            repTracesRef.current = []
            lastBottomTraceRef.current = null
            setState("setup")
            setReps(0)
            setRepScores([])
            setFeedback([])
            setBreakdown([])
            setRecapBreakdown([])
            setSelectedRecapRep(null)
            setScore(100)
          }}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground transition-all hover:bg-secondary/80"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </button>
        <button onClick={handleReset} className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90">
          New Exercise
        </button>
      </div>
    </div>
    <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
      <SheetContent side="bottom" className="max-h-[min(88vh,720px)] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Compare sessions</SheetTitle>
        </SheetHeader>
        <div className="mt-4 px-4 pb-6">
          {compareCurrent && compareBaseline ? (
            <CompareSessionsPanel current={compareCurrent} baseline={compareBaseline} />
          ) : compareCurrent && !compareBaseline ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Add another saved Coach row for <strong className="text-foreground">{compareCurrent.exercise}</strong> to unlock
              side-by-side joint deltas.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Comparison data is unavailable for this recap yet.</p>
          )}
          <Button type="button" className="mt-5 w-full" variant="outline" size="sm" onClick={() => setCompareOpen(false)}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
    <CustomExerciseBuilder
      open={customBuilderOpen}
      onOpenChange={setCustomBuilderOpen}
      guestMode={guestMode}
      onRequestSignIn={onRequestSignIn}
      onSaved={(exercise) => {
        setCustomExercises((prev) => {
          const next = prev.filter((e) => e.specId !== exercise.specId)
          return [exercise, ...next]
        })
      }}
      onPractice={(specId) => {
        setSelectedFamilyId(MY_EXERCISES_FAMILY_ID)
        setSelectedSpecId(specId)
        setCoachPickerStep("variants")
        setState("setup")
      }}
    />
    <CoachReplaySheet
      open={replayOpen}
      onOpenChange={setReplayOpen}
      sessionId={replayTarget.sessionId}
      clipId={replayTarget.clipId}
      loadKg={loadKg}
      repTraces={
        repTracesRef.current.length > 0
          ? (JSON.parse(JSON.stringify(repTracesRef.current)) as RepTracePair[])
          : undefined
      }
      reps={repScores.map((s, i) => ({
        index: i,
        score: s,
        faults: mergeFaultsFromTrace(repTracesRef.current.find((t) => t.rep === i + 1)),
      }))}
    />
    </>
  )
}
