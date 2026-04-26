"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Camera,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  ChevronRight,
  Zap,
  Target,
  Shield,
  Info,
  Dumbbell,
  Flame,
  Activity,
  BicepsFlexed,
  CircleDot,
  Move,
  Footprints,
  LayoutList,
  UserCheck,
} from "lucide-react"
import { initPoseDetection, detectPose, drawSkeleton, getBodyScanDetail, assessEnvironment, getDetectionQuality, type EnvironmentAssessment } from "@/lib/pose-detection"
import { analyzeForm, getRepPhase, hasEnoughVisibilityForExercise, EXERCISE_TIPS, type ExerciseId, type FormBreakdown, type Landmark } from "@/lib/form-analysis"
import { detectFaults } from "@/lib/coach-vision/faults"
import { renderFaults } from "@/lib/coach-vision/fault-overlay"
import { skeletonAnim } from "@/lib/skeleton-animations"
import { addCoachSession, formatErr } from "@/lib/store-supabase"
import { isNetworkError } from "@/lib/network-status"
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
import { speakRepComplete, speakGoodForm } from "@/lib/speech"
import {
  faceMatches,
  createFaceMatchSmoother,
  passesCKFaceFilter,
  getFaceEnrollment,
  saveFaceEnrollment,
  FACE_ENROLL_STABLE_FRAMES,
  type LandmarkPoint,
} from "@/lib/face-verification"
import { pushConsecutiveEnrollmentFrame } from "@/lib/face-enrollment-capture"
import { isInCenter } from "@/lib/center-check"
import { detectFall, resetFallDetection } from "@/lib/fall-detection"
import { playFallAlarm, stopFallAlarm } from "@/lib/alarm-sound"
import { Phone } from "lucide-react"
import { AICoachLlmPanel } from "@/components/ai-coach-llm-panel"

const POSTURE_PENALTY_THRESHOLD = 75
const POSTURE_PENALTY_NO_ACCUM_THRESHOLD = 85
const EMERGENCY_NUMBER = "911"

type DetectionState = "select" | "setup" | "enrolling" | "detecting" | "feedback"

const availableExercises: { id: ExerciseId; name: string; description: string; icon: typeof Dumbbell; gradient: string }[] = [
  { id: "squat", name: "Squats", description: "AI checks depth, knee alignment, and back posture", icon: Dumbbell, gradient: "from-primary/30 to-primary/10" },
  { id: "pushup", name: "Push Ups", description: "Track elbow angle, body alignment, and range of motion", icon: Activity, gradient: "from-destructive/20 to-chart-2/20" },
  { id: "plank", name: "Plank Hold", description: "Monitor hip alignment and shoulder positioning", icon: Shield, gradient: "from-chart-2/30 to-chart-4/20" },
  { id: "lunge", name: "Lunges", description: "Analyze step depth, knee tracking, and balance", icon: Flame, gradient: "from-chart-4/30 to-destructive/20" },
  { id: "bicep_curl", name: "Bicep Curls", description: "Full range and elbow control, no swinging", icon: BicepsFlexed, gradient: "from-primary/25 to-chart-2/20" },
  { id: "shoulder_press", name: "Shoulder Press", description: "Symmetry and overhead extension", icon: CircleDot, gradient: "from-chart-2/25 to-chart-4/20" },
  { id: "jumping_jacks", name: "Jumping Jacks", description: "Full arm and leg spread, steady rhythm", icon: Move, gradient: "from-chart-4/25 to-primary/20" },
  { id: "high_knees", name: "High Knees", description: "Knee drive and quick feet", icon: Footprints, gradient: "from-destructive/20 to-chart-2/20" },
  { id: "crunch", name: "Crunches", description: "Controlled curl, shoulders off floor", icon: LayoutList, gradient: "from-chart-2/30 to-primary/15" },
]

export function AICoach() {
  const { locale } = useLocale()
  const [state, setState] = useState<DetectionState>("select")
  const [selectedExercise, setSelectedExercise] = useState<ExerciseId | null>(null)
  const [score, setScore] = useState(0)
  const [reps, setReps] = useState(0)
  const [repScores, setRepScores] = useState<number[]>([])
  const [feedback, setFeedback] = useState<string[]>([])
  const [breakdown, setBreakdown] = useState<FormBreakdown[]>([])
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
  const [a11yPrefs, setA11yPrefs] = useState<CoachA11yPrefs>(() =>
    typeof window !== "undefined" ? getCoachA11yPrefs() : { hapticOnRep: true, announceReps: true, reduceMotion: false, highContrastVideo: false }
  )
  const [repBounce, setRepBounce] = useState(false)
  const [feedbackKey, setFeedbackKey] = useState(0)
  const prevFormGoodRef = useRef(true)
  const displayedScoreRef = useRef(0)
  const goalReachedAnnouncedRef = useRef(false)
  const faceSignatureRef = useRef<number[] | null>(null)
  const faceMatchSmootherRef = useRef<ReturnType<typeof createFaceMatchSmoother> | null>(null)
  const enrollBufferRef = useRef<number[][]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const lastPhaseRef = useRef<string>("idle")
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

  const exerciseName = selectedExercise ? (availableExercises.find((e) => e.id === selectedExercise)?.name ?? "") : ""

  const applyA11yPrefs = useCallback((patch: Partial<CoachA11yPrefs>) => {
    setCoachA11yPrefs(patch)
    setA11yPrefs(getCoachA11yPrefs())
  }, [])

  const handleSelectExercise = (id: string) => {
    setSelectedExercise(id as ExerciseId)
    setState("setup")
  }

  const handleStartDetection = useCallback(() => {
    setScore(100)
    setReps(0)
    setRepScores([])
    setFeedback([])
    setBreakdown([])
    repScoreStatsRef.current = { sum: 0, w: 0, min: null }
    lastPhaseRef.current = "idle"
    bottomFrameCountRef.current = 0
    bottomWasHeldRef.current = false
    topFrameCountRef.current = 0
    getRepPhase([], selectedExercise || "squat", true)
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
    setA11yPrefs(getCoachA11yPrefs())
    setState("detecting")
  }, [selectedExercise])

  const handleFinish = useCallback(async () => {
    stopFallAlarm()
    resetFallDetection()
    setFallDetected(false)
    const finalFeedback = feedback.length > 0 ? feedback : ["Great effort! Keep practicing for even better form."]
    setFeedback(finalFeedback)
    setState("feedback")
    if (selectedExercise && (reps > 0 || score > 0)) {
      const rounded = Math.round(score)
      const eff = effectiveRepCount(reps, repScores, rounded)
      const verified = isVerifiedMovement(repScores, rounded)
      const faceOk = faceVerifiedSessionRef.current
      setSessionDna({
        exercise: exerciseName,
        reps,
        score: rounded,
        repScores: [...repScores],
        effectiveReps: eff,
        verifiedMovement: verified,
        faceVerifiedSession: faceOk,
      })
      try {
        await addCoachSession({
          exercise: exerciseName,
          reps,
          score: rounded,
          repScores: [...repScores],
          effectiveReps: eff,
          verifiedMovement: verified,
          faceVerifiedSession: faceOk,
        })
        recordCoachSessionMemory(exerciseName, repScores, rounded)
        toast.success(`Saved · ${eff.toFixed(1)} effective reps · ${rounded}% form${verified ? " · Verified" : ""}`)
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
    } else {
      setSessionDna(null)
    }
  }, [selectedExercise, exerciseName, reps, score, repScores, feedback])

  const handleReset = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setState("select")
    setSelectedExercise(null)
    setScore(0)
    setReps(0)
    setTargetReps(0)
    setRepScores([])
    setFeedback([])
    setBreakdown([])
    setSessionDna(null)
  }, [])

  // Init pose (including "enrolling" so coach face capture can use detectPose)
  useEffect(() => {
    if (state !== "setup" && state !== "detecting" && state !== "enrolling") return
    let cancelled = false
    initPoseDetection().then((ok) => {
      if (!cancelled) {
        setPoseReady(ok)
        if (!ok) {
          console.error("[AI Coach] Pose detection failed to initialize")
          toast.error("Pose detection failed to initialize")
        }
      }
    })
    return () => { cancelled = true }
  }, [state])

  // Stop fall alarm when leaving detecting; reset face match smoother for new session
  useEffect(() => {
    if (state === "detecting") {
      faceMatchSmootherRef.current = createFaceMatchSmoother()
    } else {
      faceMatchSmootherRef.current = null
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
    createClient()
      .auth.getUser()
      .then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
        if (cancelled || !user) return
        return getFaceEnrollment(user.id)
      })
      .then((sig: number[] | null) => {
        if (cancelled) return
        faceSignatureRef.current = sig ?? null
        setFaceEnrolled(!!sig?.length)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [state])

  // Enrolling: await pose, then camera; require consecutive stable frames then averaged signature
  useEffect(() => {
    if (state !== "enrolling") return
    let cancelled = false
    let stream: MediaStream | null = null
    let running = true
    let lastTime = 0
    enrollBufferRef.current = []
    setEnrollProgress(0)

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
      const result = detectPose(video, timestamp)
      if (!result?.landmarks?.length) return
      const lm = result.landmarks as LandmarkPoint[]
      const { buffer, signature, progress } = pushConsecutiveEnrollmentFrame(enrollBufferRef.current, lm)
      enrollBufferRef.current = buffer
      setEnrollProgress(progress)
      if (!signature) return
      running = false
      cancelAnimationFrame(animRef.current)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      stream = null
      streamRef.current = null
      const sig = signature
      createClient()
        .auth.getUser()
        .then(async ({ data: { user } }: { data: { user: { id: string } | null } }) => {
          if (!user) {
            toast.error("Sign in to enroll your face")
            setState("setup")
            return
          }
          const ok = await saveFaceEnrollment(user.id, sig)
          if (cancelled) return
          if (!ok) {
            toast.error("Could not save face (storage blocked). Check browser site settings and try again.")
            setState("setup")
            return
          }
          faceSignatureRef.current = sig
          setFaceEnrolled(true)
          setState("setup")
          toast.success("Face enrolled — only your reps will count")
        })
        .catch(() => {
          toast.error("Could not enroll face")
          setState("setup")
        })
    }

    void initPoseDetection().then((ok) => {
      if (cancelled) return
      if (!ok) {
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
    if (state !== "detecting" || !selectedExercise) return
    if (detectingStartedAtRef.current === 0) detectingStartedAtRef.current = Date.now()
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

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
        if (video) {
          video.srcObject = s
          video.play().catch(() => {})
          // Set video dimensions for better canvas rendering
          // Keep canvas at fixed 640x480 so skeleton coords stay consistent
        }
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
    const exercise = selectedExercise

    const runDetection = (timestamp: number) => {
      if (!running) return
      animRef.current = requestAnimationFrame(runDetection)
      const delta = timestamp - lastTime
      const isVideoReady = Boolean(useCamera && video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0)
      const minDelta = isVideoReady ? 1000 / 30 : 1000 / 60
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
        
        const result = detectPose(video, timestamp)
        if (result?.landmarks?.length) {
          const lm = result.landmarks as LandmarkPoint[]
          const centered = isInCenter(lm)
          setUserCentered(centered)
          const storedSig = faceSignatureRef.current
          const hasEnrollment = !!storedSig?.length
          const smooth = faceMatchSmootherRef.current
          const match = !hasEnrollment ? true : smooth ? smooth(lm, storedSig) : faceMatches(lm, storedSig)
          const instantMatch = !hasEnrollment ? true : faceMatches(lm, storedSig)
          setFaceMatch(match)
          const ckOk = passesCKFaceFilter(lm)
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
            setBodyScanSummary(readable)
          }
          const env = assessEnvironment(result.landmarks, timestamp, exercise)
          setEnvAssessment(env)
          const worldLm = (result.worldLandmarks ?? undefined) as Landmark[] | undefined
          const res = analyzeForm(result.landmarks, exercise, {
            world: worldLm && worldLm.length >= 33 ? worldLm : undefined,
            trackingQuality: getDetectionQuality(),
          })
          setScore(res.score)
          setIsGoodForm(res.isGoodForm)
          setBreakdown(res.breakdown)

          // Form change → ripple animation
          if (res.isGoodForm !== prevFormGoodRef.current) {
            prevFormGoodRef.current = res.isGoodForm
            skeletonAnim.onFormChange(res.isGoodForm, result.landmarks)
          }

          if (!exerciseBodyOk) {
            setLiveFeedback("Get your full body in frame so the coach can see you.")
          } else if (hasEnrollment && !match) {
            setLiveFeedback("Face not recognized — only your enrolled face counts reps. Hold steady for a moment.")
          } else if (hasEnrollment && match && !ckOk) {
            setLiveFeedback("Look toward the camera so your face is clearly visible.")
          } else {
            const newFb = res.feedback[0] ?? "Good form."
            setLiveFeedback(prev => {
              if (prev !== newFb) setFeedbackKey(k => k + 1)
              return newFb
            })
          }

          // Only require that the relevant body parts are visible; don't double‑gate by generic visibility count
          const enoughVisible = exerciseBodyOk
          const phase = enoughVisible ? getRepPhase(result.landmarks, exercise, false) : "idle"
          if (!enoughVisible) {
            lastPhaseRef.current = "idle"
            bottomFrameCountRef.current = 0
            topFrameCountRef.current = 0
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
            addRepFormSample(res.score, W_BOTTOM)
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
          const topHeld = topFrameCountRef.current >= 1
          const standardRepComplete =
            phase === "top" &&
            (lastPhaseRef.current === "concentric" || lastPhaseRef.current === "bottom") &&
            repScoreStatsRef.current.w > 0 &&
            canCountRep &&
            bottomWasHeldRef.current &&
            topHeld
          const cardioRepComplete =
            isCardio &&
            phase === "top" &&
            lastPhaseRef.current === "bottom" &&
            canCountRep &&
            bottomWasHeldRef.current &&
            topHeld
          // Very permissive fallback: if we reach TOP after leaving it and the body + face are ok, count a rep
          const simpleRepComplete = phase === "top" && lastPhaseRef.current !== "top" && exerciseBodyOk && faceOk
          const repComplete = standardRepComplete || cardioRepComplete || simpleRepComplete
          if (repComplete && now - lastRepAtRef.current >= 600) {
            lastRepAtRef.current = now
            bottomWasHeldRef.current = false
            skeletonAnim.onRepComplete(result.landmarks)
            setRepBounce(true)
            setTimeout(() => setRepBounce(false), 400)
            const st = repScoreStatsRef.current
            const repScore = st.w > 0 ? Math.round(st.sum / st.w) : res.score
            const repScoreForPenalty = st.min ?? res.score
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
          if (res.isGoodForm && now - lastVoiceAtRef.current > 22000 && Math.random() < 0.35) {
            lastVoiceAtRef.current = now
            speakGoodForm()
          }
          skeletonAnim.update(timestamp, result.landmarks, {
            score: res.score,
            isGoodForm: res.isGoodForm,
            phase,
            exercise,
          })
          // Detect form faults for per-segment red highlighting
          const { faults } = detectFaults(
            result.landmarks as unknown as Landmark[],
            exercise as ExerciseId,
            res,
            worldLm && worldLm.length >= 33 ? worldLm : undefined
          )
          const faultSegmentPairs = faults.flatMap(f =>
            f.segmentPairs ?? []
          ) as [number, number][]

          ctx.clearRect(0, 0, cw, ch)
          skeletonAnim.drawScanSweep(ctx, cw, ch, result.landmarks)
          drawSkeleton(ctx, result.landmarks, cw, ch, res.isGoodForm, {
            left: result.leftHandLandmarks,
            right: result.rightHandLandmarks,
          }, res.score, faultSegmentPairs)
          skeletonAnim.draw(ctx, cw, ch, result.landmarks)

          if (faults.length) {
            renderFaults(ctx, result.landmarks as unknown as Landmark[], faults, {
              width: cw,
              height: ch,
              // Canvas uses CSS scaleX(-1); skeleton uses unmirrored x*width — do not mirror here or fault lines flip wrong side.
              mirror: false,
              pulse: Math.sin(performance.now() / 200) * 0.5 + 0.5,
            })
            const worst = faults.find(f => f.severity === "severe") ?? faults[0]
            if (worst && liveFeedback !== worst.cue) setLiveFeedback(worst.cue)
          }
          return
        } else {
          setBodyScanSummary(null)
          lastPhaseRef.current = "idle"
          bottomFrameCountRef.current = 0
          topFrameCountRef.current = 0
          ctx.clearRect(0, 0, cw, ch)
          const feedbackMsg = poseReady 
            ? "Position yourself in frame to start detection." 
            : "Initializing pose detection..."
          if (liveFeedback !== feedbackMsg && Math.random() < 0.1) {
            setLiveFeedback(feedbackMsg)
          }
          return
        }
      } else if (video && useCamera) {
        // Video not ready yet - just clear canvas
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
        setLiveFeedback(simGood ? "Looking good. Keep it up." : "Adjust form for better alignment.")
      } else {
        // Camera available but not ready - just clear
        ctx.clearRect(0, 0, cw, ch)
      }
    }

    animRef.current = requestAnimationFrame(runDetection)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedExercise, useCamera, poseReady])

  if (state === "select") {
    return (
      <div className="flex flex-col gap-5 px-4 pt-4 pb-28">
        <header>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            AI Body Coach
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time pose detection and form analysis for every rep
          </p>
        </header>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ScanLine, label: "Pose Detection", color: "bg-metric-coach/15 text-metric-coach" },
            { icon: Target, label: "Form Score", color: "bg-metric-move/15 text-metric-move" },
            { icon: Shield, label: "Injury Prevention", color: "bg-metric-streak/15 text-metric-streak" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 border border-border">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${f.color}`}>
                <f.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] text-muted-foreground text-center">{f.label}</span>
            </div>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-chart-2/20 h-48 flex items-center justify-center">
          <Camera className="h-16 w-16 text-primary/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              AI-Powered Form Check
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Real-time body tracking and rep-by-rep form scoring
            </p>
          </div>
        </div>
        <h2 className="text-sm font-semibold text-foreground">Choose Exercise</h2>
        <div className="grid grid-cols-2 gap-3">
          {availableExercises.map((ex) => {
            const Icon = ex.icon
            return (
              <button
                key={ex.id}
                onClick={() => handleSelectExercise(ex.id)}
                className="group flex min-h-[140px] flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-all hover:border-metric-coach/40 hover:ring-2 hover:ring-metric-coach/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-coach"
              >
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${ex.gradient} flex items-center justify-center shrink-0`}>
                  <Icon className="h-7 w-7 text-white/90" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className="text-base font-bold text-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {ex.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{ex.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (state === "setup") {
    const exercise = availableExercises.find((e) => e.id === selectedExercise)
    const tips = selectedExercise ? EXERCISE_TIPS[selectedExercise] ?? [] : []
    const memoryTip = exercise ? getCoachMemoryTip(exercise.name) : null
    const culturalExtras = selectedExercise ? getCulturalTipExtras(locale, selectedExercise) : []
    const SetupIcon = exercise?.icon ?? Camera
    return (
      <div className="flex flex-col items-center gap-6 px-4 pt-8 pb-28">
        <button
          onClick={handleReset}
          className="self-start flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back
        </button>
        <div className={`flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br ${exercise?.gradient ?? "from-primary/15 to-primary/10"}`}>
          <SetupIcon className="h-12 w-12 text-white/90" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {exercise?.name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            Position your full body in the camera frame. Stand 6–8 ft away for best detection.
          </p>
        </div>
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
                <span className="text-[10px] font-semibold uppercase text-chart-2">From your last sessions</span>
                <p className="text-sm text-foreground mt-0.5">{memoryTip}</p>
              </div>
            </div>
          )}
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
    )
  }

  if (state === "enrolling") {
    return (
      <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24">
        <div className="relative h-[78vh] min-h-[450px] max-h-[85vh] bg-secondary overflow-hidden rounded-3xl border-4 border-primary/40 mx-2 mt-2">
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
    )
  }

  if (state === "detecting") {
    return (
      <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24">
        <div className="relative h-[78vh] min-h-[450px] max-h-[85vh] bg-secondary overflow-hidden rounded-3xl border-4 border-primary/40 shadow-[0_0_0_2px_var(--border)] ring-4 ring-primary/20 mx-2 mt-2">
          {useCamera && (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover mirror z-0"
              playsInline
              muted
              style={{
                transform: "scaleX(-1)",
                ...(a11yPrefs.highContrastVideo ? { filter: "contrast(1.22) brightness(1.06)" } : {}),
              }}
            />
          )}
          {!useCamera && (
            <div className="absolute inset-0 bg-gradient-to-br from-secondary to-background flex items-center justify-center z-0">
              <Camera className="h-20 w-20 text-muted-foreground/40" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ transform: "scaleX(-1)", zIndex: 10 }}
            aria-label="Skeleton overlay"
          />
          {fallDetected && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/85 backdrop-blur-sm p-6">
              <div className="rounded-2xl bg-destructive/20 border-2 border-destructive p-6 text-center max-w-sm">
                <p className="text-xl font-bold text-destructive">Possible fall detected</p>
                <p className="text-sm text-white/90 mt-2">If you need help, call emergency services.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <a
                  href={`tel:${EMERGENCY_NUMBER}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-destructive py-4 px-6 font-semibold text-destructive-foreground hover:bg-destructive/90"
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
                  className="rounded-xl bg-primary py-4 px-6 font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  I&apos;m OK
                </button>
              </div>
            </div>
          )}
          {useCamera && (
            <div className="absolute inset-x-4 bottom-4 z-30 rounded-xl bg-black/75 backdrop-blur-md px-4 py-3 border border-white/10 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                  <Camera className="h-4 w-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {envAssessment?.suggestion ? (
                    <p className="text-sm font-medium text-amber-200">{envAssessment.suggestion}</p>
                  ) : (
                    <p className="text-sm font-medium text-white">
                      For best detection, keep <strong className="text-amber-300">3–4 feet</strong> between you and the camera.
                    </p>
                  )}
                  <p className="text-xs text-white/70 mt-0.5">
                    Stay in the <strong>center</strong> (dashed box) for rep counting. Full body in frame = better detection.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {bodyScanSummary && (
                      <span className="text-[11px] text-emerald-400/90">
                        Body: {bodyScanSummary}
                      </span>
                    )}
                    {envAssessment && (
                      <>
                        <span className={`text-[11px] ${envAssessment.fpsLow ? "text-red-400" : "text-emerald-400/70"}`}>
                          {envAssessment.fps} fps
                        </span>
                        <span className={`text-[11px] ${envAssessment.quality > 0.6 ? "text-emerald-400/70" : envAssessment.quality > 0.3 ? "text-amber-400/70" : "text-red-400/70"}`}>
                          Quality: {Math.round(envAssessment.quality * 100)}%
                        </span>
                        {envAssessment.cameraAngle !== "unknown" && (
                          <span className={`text-[11px] ${envAssessment.angleRecommended ? "text-emerald-400/70" : "text-amber-400/70"}`}>
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
          <div
            className={`absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-sm transition-all duration-300 ${
              isGoodForm ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
            }`}
          >
            {isGoodForm ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="text-xs font-semibold">{isGoodForm ? "Good Form" : "Adjust Form"}</span>
          </div>
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            <div className={`rounded-xl bg-background/80 backdrop-blur-sm px-4 py-2 transition-transform duration-300 ${repBounce ? "animate-rep-bounce" : ""}`}>
              <span className="text-xs text-muted-foreground block">{targetReps > 0 ? "Reps (goal)" : "Reps"}</span>
              <span className="text-2xl font-bold text-foreground tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
                {targetReps > 0 ? `${reps} / ${targetReps}` : reps}
              </span>
              {targetReps > 0 && reps >= targetReps && (
                <span className="text-[10px] font-semibold text-primary mt-0.5 block">Goal reached!</span>
              )}
            </div>
            {useCamera && (
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm ${
                    userCentered ? "bg-emerald-500/25 text-emerald-300" : "bg-amber-500/25 text-amber-300"
                  }`}
                  title={userCentered ? "You're in the center zone" : "Move into the dashed box"}
                >
                  {userCentered ? "Center ✓" : "Center"}
                </span>
                {faceEnrolled && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm ${
                      faceMatch ? "bg-emerald-500/25 text-emerald-300" : "bg-destructive/25 text-destructive"
                    }`}
                    title={faceMatch ? "Your face — reps count" : "Different face — reps not counted"}
                  >
                    {faceMatch ? "You ✓" : "Other"}
                  </span>
                )}
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm bg-blue-500/25 text-blue-300"
                  title="Alarm and emergency call if a fall is detected"
                >
                  Fall detection: on
                </span>
              </div>
            )}
          </div>
          {!useCamera && (
            <div className="absolute bottom-4 left-4 right-4 z-[600] rounded-xl bg-chart-4/90 backdrop-blur-sm px-4 py-2.5 border border-chart-4/50">
              <p className="text-xs font-medium text-foreground">
                Simulated mode — camera denied or unavailable. Rep counting and form feedback still work.
              </p>
            </div>
          )}
        </div>
        <div className="flex-1 px-4 pt-4 space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3">
            <RingGauge
              value={score}
              max={100}
              size={80}
              thickness={7}
              spring
              progressClassName="stroke-metric-coach"
            >
              <span
                className="text-2xl font-bold tabular-nums leading-none text-foreground animate-score-roll"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {score}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-metric-coach">
                Form
              </span>
            </RingGauge>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Live score
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${isGoodForm ? "bg-metric-move/15 text-metric-move" : "bg-destructive/15 text-destructive"}`}>
                  {isGoodForm ? "On target" : "Adjust"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-metric-coach transition-all duration-500 ease-out"
                  style={{ width: `${score}%` }}
                />
              </div>
              {envAssessment && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <svg width="24" height="14" viewBox="0 0 24 14" className="shrink-0">
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
                  Detection
                </div>
              )}
            </div>
          </div>
          {breakdown.length > 0 && (
            <div className="rounded-xl bg-card p-3 border border-border">
              <div className="text-xs font-semibold text-foreground mb-2">Live form breakdown</div>
              <div className="flex flex-wrap gap-2">
                {breakdown.map((b, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors duration-300 ${b.ok ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}
                    title={b.detail}
                  >
                    {b.label}: {b.value}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl bg-card p-4 border border-border overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <span id="coach-live-label" className="text-sm font-semibold text-foreground">Live feedback</span>
            </div>
            <p
              key={feedbackKey}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-labelledby="coach-live-label"
              className="text-xs text-muted-foreground animate-feedback-slide"
            >
              {liveFeedback}
            </p>
          </div>
          <button
            onClick={handleFinish}
            className="w-full rounded-xl bg-primary py-4 text-center font-semibold text-primary-foreground text-base transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            End session
          </button>
        </div>
      </div>
    )
  }

  const avgRepScore = repScores.length > 0 ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length) : score
  const effLine =
    sessionDna != null
      ? `${sessionDna.effectiveReps.toFixed(1)} effective reps${sessionDna.verifiedMovement ? " · Verified" : ""}`
      : null
  return (
    <div className="flex flex-col items-center gap-6 px-4 pt-8 pb-28">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <svg className="absolute inset-0" viewBox="0 0 144 144">
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
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
          Workout Complete
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {reps} reps · {score}% form · {exerciseName}
          {effLine ? ` · ${effLine}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <div className="rounded-xl bg-card p-4 border border-border text-center">
          <span className="text-2xl font-bold text-foreground">{reps}</span>
          <p className="text-[10px] text-muted-foreground uppercase">Total Reps</p>
        </div>
        <div className="rounded-xl bg-card p-4 border border-border text-center">
          <span className="text-2xl font-bold text-primary">{avgRepScore}%</span>
          <p className="text-[10px] text-muted-foreground uppercase">Avg rep quality</p>
        </div>
        {repScores.length > 0 && (
          <>
            <div className="rounded-xl bg-card p-4 border border-border text-center">
              <span className="text-2xl font-bold text-chart-4">{Math.max(...repScores)}%</span>
              <p className="text-[10px] text-muted-foreground uppercase">Best rep</p>
            </div>
            <div className="rounded-xl bg-card p-4 border border-border text-center">
              <span className="text-2xl font-bold text-chart-2">{repScores.filter((s) => s >= 80).length}</span>
              <p className="text-[10px] text-muted-foreground uppercase">High-form reps</p>
            </div>
          </>
        )}
        {sessionDna != null && (
          <div className="rounded-xl bg-card p-4 border border-border text-center col-span-2">
            <span className="text-2xl font-bold text-chart-2">{sessionDna.effectiveReps.toFixed(1)}</span>
            <p className="text-[10px] text-muted-foreground uppercase">Effective reps (form-weighted)</p>
          </div>
        )}
      </div>
      {sessionDna != null && (
        <div className="w-full max-w-sm">
          <SessionDnaCard {...sessionDna} />
        </div>
      )}
      {repScores.length > 0 && (
        <div className="w-full max-w-sm">
          <h3 className="text-sm font-semibold text-foreground mb-2">Rep-by-rep quality</h3>
          <div className="flex flex-wrap gap-2">
            {repScores.map((s, i) => (
              <span
                key={i}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${
                  s >= 80 ? "bg-primary/20 text-primary" : s >= 60 ? "bg-chart-4/20 text-chart-4" : "bg-destructive/20 text-destructive"
                }`}
                title={`Rep ${i + 1}: ${s}%`}
              >
                {s}%
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="w-full max-w-sm space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Coach feedback</h3>
        {feedback.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl bg-card p-3 border border-border">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">{item}</span>
          </div>
        ))}
      </div>
      {selectedExercise && (
        <AICoachLlmPanel
          exerciseId={selectedExercise}
          exerciseName={exerciseName}
          reps={reps}
          score={Math.round(score)}
          repScores={repScores}
          feedback={feedback}
        />
      )}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={() => {
            setSessionDna(null)
            setState("setup")
            setReps(0)
            setRepScores([])
            setFeedback([])
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
  )
}
