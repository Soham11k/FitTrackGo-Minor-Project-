"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CHROME } from "@/lib/app-chrome"
import {
  Camera,
  ChevronRight,
  UserCheck,
  Phone,
  X,
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
import { addCoachSession, formatErr, getCoachSessions, getTotalStats } from "@/lib/store-supabase"
import { isNetworkError } from "@/lib/network-status"
import { hasSpec as coachHasSpec, loadSpec as coachLoadSpecRaw } from "@/lib/form-engine/registry"
import { effectiveRepCount, isVerifiedMovement } from "@/lib/competition"
import { recordCoachSessionMemory } from "@/lib/coach-memory"
import { hapticRepPulse, getCoachA11yPrefs, setCoachA11yPrefs, type CoachA11yPrefs } from "@/lib/coach-a11y"
import { SessionDnaCard, type SessionDnaProps } from "@/components/session-dna-card"
import { useLocale } from "@/components/locale-provider"
import { createClient } from "@/lib/supabase/client"
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
import type { TabId } from "@/components/bottom-nav"
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  COACH_FORM,
  CoachBackButton,
  CoachDarkPanel,
  CoachFaceStatus,
  CoachFormCues,
  CoachFormHeader,
  CoachHeroTitle,
  CoachCustomExerciseBar,
  CoachLiveStatsRow,
  CoachLiveFeedbackCard,
  CoachMovementRow,
  CoachOutlineCta,
  CoachPrivacyBanner,
  CoachRedToggle,
  CoachRepGoalInput,
  CoachSetLoadRow,
  CoachTipBox,
  CoachTrackTabs,
} from "@/components/ai-coach/coach-form-ui"
import { CoachWorkoutComplete } from "@/components/ai-coach/coach-workout-complete"

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
  const { t } = useLocale()
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
  const [loadKg, setLoadKg] = useState<number | undefined>(undefined)
  const [bodyWeightKg, setBodyWeightKg] = useState<number | undefined>(undefined)
  const [weightUnitPref, setWeightUnitPref] = useState<"kg" | "lb">("kg")
  const [ghostEnabled] = useState(false)
  const [ghostFrames, setGhostFrames] = useState<RepFrame[]>([])
  const repReplayBufferRef = useRef<RepReplayBuffer>(new RepReplayBuffer(12_000))
  // Per-rep timing info for Motion DNA (durationMs, rom-approximation, symmetry)
  const repDnaDataRef = useRef<RepSample[]>([])
  const [state, setState] = useState<DetectionState>("select")
  const [setupPhase, setSetupPhase] = useState<"exercise" | "accessibility">("exercise")
  const [streakDays, setStreakDays] = useState(0)
  const [coachTrack, setCoachTrack] = useState<"strength" | "mobility">("strength")
  const [a11yPrefs, setA11yPrefs] = useState<CoachA11yPrefs>(() =>
    typeof window !== "undefined" ? getCoachA11yPrefs() : { hapticOnRep: true, announceReps: true, reduceMotion: false, highContrastVideo: false }
  )
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

  useEffect(() => {
    void getTotalStats()
      .then((s) => setStreakDays(s.streak))
      .catch(() => {})
  }, [])

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
    setSetupPhase("exercise")
  }

  const handleSetupBack = () => {
    if (setupPhase === "accessibility") {
      setSetupPhase("exercise")
      return
    }
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
    setFeedback(finalFeedback)
    setState("feedback")
    setFinishShareSessionId(null)
    setReplayTarget({ sessionId: null, clipId: null })

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
    setSessionDna(null)
    setRecapIsPr(false)
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
            setSetupPhase("accessibility")
            setState("setup")
            return
          }
          const ok = await saveFaceEnrollment(user.id, sig, embeddingVersion)
          if (cancelled) return
          if (!ok) {
            toast.error("Could not save face (storage blocked). Check browser site settings and try again.")
            setSetupPhase("accessibility")
            setState("setup")
            return
          }
          faceSignatureRef.current = sig
          faceEmbeddingVersionRef.current = embeddingVersion
          setFaceEnrolled(true)
          setSetupPhase("accessibility")
          setState("setup")
          toast.success("Face enrolled — only your reps will count")
        })
        .catch(() => {
          toast.error("Could not enroll face")
          setSetupPhase("accessibility")
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
    const selectedFamily = selectedFamilyId ? getCoachFamily(selectedFamilyId) : null
    const variantCategory = selectedFamily?.category ?? "upper"

    return (
      <>
        {coachFocusBar}
        {coachTrack === "mobility" ? (
          <MobilityCoach onBack={() => setCoachTrack("strength")} />
        ) : (
          <div
            data-testid="screen-ai-coach"
            className="flex min-h-dvh flex-col pb-28"
            style={{ backgroundColor: CHROME.homeBlack }}
          >
            <CoachFormHeader streakDays={streakDays} guest={guestMode} />
            <CoachHeroTitle
              eyebrow="AI Coach"
              title="Choose movement"
            />
            <CoachPrivacyBanner text={t("coach.privacyBanner")} />
            <CoachTrackTabs track={coachTrack} onTrack={setCoachTrack} />

            <div className="flex flex-col gap-2.5 px-0">
              <AnimatePresence mode="wait">
                {coachPickerStep === "variants" ? (
                  <motion.div
                    key="variants"
                    className="flex flex-col gap-2.5"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  >
                    <CoachBackButton label="All movements" onClick={handlePickerBackToFamilies} />
                    {activePickerVariants.map((v, i) => {
                      const variantTitle =
                        v.specId === "deadlift"
                          ? t("coach.deadlift.name")
                          : v.specId === "rdl"
                            ? t("coach.rdl.name")
                            : v.name
                      return (
                        <div key={v.specId} className="px-4">
                          <CoachMovementRow
                            index={i}
                            title={variantTitle}
                            subtitle={v.description.toUpperCase()}
                            category={variantCategory}
                            onClick={() => handleSelectVariant(v.specId)}
                            delay={i * 0.04}
                          />
                        </div>
                      )
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="families"
                    className="flex flex-col gap-2.5"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  >
                    <CoachCustomExerciseBar
                      moveCount={pickerFamilies.length}
                      onCustom={() => setCustomBuilderOpen(true)}
                    />

                    {pickerFamilies.map((fam, i) => (
                      <div key={fam.id} className="px-4">
                        <CoachMovementRow
                          index={i}
                          title={fam.name}
                          subtitle={(fam.variants[0]?.description ?? fam.description).toUpperCase()}
                          category={fam.category}
                          onClick={() => handleSelectFamily(fam.id)}
                          delay={i * 0.04}
                        />
                      </div>
                    ))}
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
    const spec = selectedSpecId ? coachLoadSpec(selectedSpecId) : null
    const showLoadChip = spec?.loadType === "external"
    const exerciseTitle = (exerciseName || "Exercise").toUpperCase()
    const exerciseDescription =
      catalogCtx?.variant.description ??
      "Position your full body in the camera frame for best rep detection."
    const cameraNote =
      catalogCtx?.variant.cameraNote ??
      "Stand 6–8 ft from camera, full body in frame for best rep detection."

    if (setupPhase === "accessibility") {
      return (
        <>
          {coachFocusBar}
          <div className="flex min-h-dvh flex-col pb-32" style={{ backgroundColor: CHROME.homeBlack }}>
            <CoachFormHeader streakDays={streakDays} guest={guestMode} />
            <CoachHeroTitle
              eyebrow="Coach"
              title="Accessibility"
              subtitle="Preferences saved on this device only."
            />
            <div className="flex flex-col gap-4 px-4">
              <CoachDarkPanel className="space-y-4">
                {(
                  [
                    ["hapticOnRep", "Haptic on rep", "Short vibration when a rep counts"] as const,
                    ["announceReps", "Announce reps", "Speak rep milestones out loud"] as const,
                    ["reduceMotion", "Reduce motion", "Lighter skeleton and UI motion"] as const,
                    ["highContrastVideo", "High-contrast video", "Boost camera contrast while detecting"] as const,
                  ] as const
                ).map(([key, label, desc]) => (
                  <CoachRedToggle
                    key={key}
                    label={label}
                    description={desc}
                    checked={a11yPrefs[key]}
                    onChange={(v) => applyA11yPrefs({ [key]: v })}
                  />
                ))}
              </CoachDarkPanel>

              <CoachDarkPanel>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.24em]"
                  style={{ color: COACH_FORM.accent }}
                >
                  Optional
                </p>
                <CoachRepGoalInput value={targetReps} onChange={setTargetReps} />
              </CoachDarkPanel>

              <CoachDarkPanel>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.24em]"
                  style={{ color: COACH_FORM.accent }}
                >
                  Identity
                </p>
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: COACH_FORM.muted }}>
                  One account, one face. Enroll your face so only your reps count.
                </p>
                <CoachFaceStatus enrolled={faceEnrolled} onEnroll={() => setState("enrolling")} />
              </CoachDarkPanel>
            </div>

            <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-20 px-4">
              <CoachOutlineCta label="Start session" onClick={handleStartDetection} />
            </div>
          </div>
        </>
      )
    }

    return (
      <>
        {coachFocusBar}
        <div className="flex min-h-dvh flex-col pb-32" style={{ backgroundColor: CHROME.homeBlack }}>
          <CoachFormHeader streakDays={streakDays} guest={guestMode} />
          <CoachBackButton onClick={handleSetupBack} />
          <div className="px-4">
            <CoachDarkPanel>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.28em]"
                style={{ color: COACH_FORM.accent }}
              >
                Exercise
              </p>
              <h2
                className="mt-1 text-[1.75rem] font-black uppercase leading-none text-white"
                style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
              >
                {exerciseTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: COACH_FORM.muted }}>
                {exerciseDescription}
              </p>
              <CoachTipBox>{cameraNote}</CoachTipBox>
              {showLoadChip && selectedSpecId ? (
                <CoachSetLoadRow unit={weightUnitPref} valueKg={loadKg} onChange={setLoadKg} />
              ) : null}
              <CoachFormCues tips={tips} />
            </CoachDarkPanel>
          </div>
          <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-20">
            <CoachOutlineCta label="Start exercise" onClick={() => setSetupPhase("accessibility")} />
          </div>
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
        <button onClick={() => { setSetupPhase("accessibility"); setState("setup") }} className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium">
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
      <div className="flex min-h-dvh flex-col pb-28" style={{ backgroundColor: CHROME.homeBlack }}>
        <CoachFormHeader streakDays={streakDays} guest={guestMode} />
        <div
          className="relative mx-4 mt-1 h-[min(52vh,400px)] min-h-[320px] overflow-hidden rounded-2xl"
          style={{ backgroundColor: COACH_FORM.card }}
        >
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
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
              <Camera className="h-16 w-16 text-white/20" />
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
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full px-3 py-1" style={{ backgroundColor: COACH_FORM.accentDim, border: `1px solid ${COACH_FORM.accentBorder}` }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COACH_FORM.accent }} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white" style={{ fontFamily: COACH_FORM.labelFont }}>
              Live
            </span>
          </div>
          {!isGoodForm ? (
            <div
              className="absolute right-3 top-3 z-20 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ backgroundColor: "rgba(251,191,36,0.15)", color: "#fbbf24", fontFamily: COACH_FORM.labelFont }}
            >
              Adjust form
            </div>
          ) : null}
          {!useCamera && (
            <div className="absolute bottom-4 left-4 right-4 z-[600] rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
              <p className="text-xs font-medium text-amber-100/90">
                Simulated mode — camera denied or unavailable. Rep counting and form feedback still work.
              </p>
            </div>
          )}
          {coachLivePrimary ? (
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[25] rounded-xl border px-4 py-3" style={{ borderColor: COACH_FORM.cardBorder, backgroundColor: "rgba(0,0,0,0.72)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: COACH_FORM.accent, fontFamily: COACH_FORM.labelFont }}>
                Form cue — {coachLivePrimary}
              </p>
            </div>
          ) : null}
        </div>

        <CoachLiveStatsRow
          reps={reps}
          formScore={score}
          userCentered={userCentered}
          faceVerified={faceMatch}
          faceEnrolled={!!faceEnrolled}
        />

        <div className="space-y-3 px-4 pt-3">
          <CoachLiveFeedbackCard
            primary={coachLivePrimary || "Get your full body in frame so the coach can see you."}
            secondary={
              envAssessment?.fpsLow
                ? "Move closer or add light for clearer cues."
                : envAssessment?.suggestion ?? null
            }
            fps={envAssessment?.fps}
            detectionLine={[
              "Detection",
              `Pose: ${poseReady ? "tracking" : "searching"}`,
              bodyScanSummary ? `Body: ${bodyScanSummary}` : null,
              envAssessment
                ? `Quality ${Math.round(envAssessment.quality * 100)}%${envAssessment.cameraAngle !== "unknown" ? ` · ${envAssessment.cameraAngle} view` : ""}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          {selectedSpecId ? (
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
              variant="coach-dark"
            />
          ) : null}
          <button
            type="button"
            onClick={handleFinish}
            className="w-full rounded-2xl border py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-white"
            style={{ borderColor: COACH_FORM.accentBorder, backgroundColor: COACH_FORM.accentDim, fontFamily: COACH_FORM.labelFont }}
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
  const finalScore = sessionDna?.score ?? avgRepScore

  const tryAgain = () => {
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
    setScore(100)
  }

  return (
    <>
      {coachFocusBar}
      <CoachWorkoutComplete
        streakDays={streakDays}
        guest={guestMode}
        exerciseName={exerciseName}
        reps={reps}
        formPct={finalScore}
        qualityPct={avgRepScore}
        formScore={finalScore}
        encouragement={feedback[0] ?? "Great effort! Keep practising for even better form."}
        zeroRepsWarning={
          sessionDna == null && !(replayTarget.sessionId || replayTarget.clipId)
            ? `${reps} reps recorded. Complete reps with camera on, then tap End session to save a replay.`
            : null
        }
        askCoachSlot={
          selectedSpecId ? (
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
              variant="coach-dark"
            />
          ) : null
        }
        extrasSlot={
          <>
            {recapIsPr ? (
              <div
                className="rounded-2xl border px-4 py-2.5 text-center text-sm font-bold uppercase tracking-[0.2em]"
                style={{ borderColor: COACH_FORM.accentBorder, color: COACH_FORM.accent, backgroundColor: COACH_FORM.accentDim }}
              >
                Personal record
              </div>
            ) : null}
            {sessionDna != null ? <SessionDnaCard {...sessionDna} ringSize={120} className="border-white/10" /> : null}
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
            {sessionDna != null ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
                  onClick={() => void handleOpenCompareSheet()}
                >
                  Compare sessions
                </Button>
                {onNavigate ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
                    onClick={handleOpenArenaFromRecap}
                  >
                    Open Arena
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        }
        onTryAgain={tryAgain}
        onNewExercise={handleReset}
      />
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
        setSetupPhase("exercise")
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
