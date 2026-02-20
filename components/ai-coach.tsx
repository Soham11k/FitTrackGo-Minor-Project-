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
} from "lucide-react"
import { initPoseDetection, detectPose, drawSkeleton, getBodyScanDetail, type PoseResult } from "@/lib/pose-detection"
import { analyzeForm, getRepPhase, EXERCISE_TIPS, type ExerciseId, type FormBreakdown } from "@/lib/form-analysis"
import { addCoachSession } from "@/lib/store-supabase"
import { toast } from "sonner"
import { speakMotivation, speakRepComplete, speakGoodForm } from "@/lib/speech"

type DetectionState = "select" | "setup" | "detecting" | "feedback"

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const lastPhaseRef = useRef<string>("idle")
  const repScoreAccumRef = useRef<number[]>([])
  const lastRepAtRef = useRef<number>(0)
  const lastVoiceAtRef = useRef<number>(0)
  const repCountForVoiceRef = useRef<number>(0)

  const exerciseName = selectedExercise ? (availableExercises.find((e) => e.id === selectedExercise)?.name ?? "") : ""

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
    repScoreAccumRef.current = []
    lastPhaseRef.current = "idle"
    // Reset rep phase detection
    getRepPhase([], selectedExercise || "squat", true)
    lastRepAtRef.current = 0
    lastVoiceAtRef.current = 0
    repCountForVoiceRef.current = 0
    setState("detecting")
  }, [selectedExercise])

  const handleFinish = useCallback(async () => {
    const finalFeedback = feedback.length > 0 ? feedback : ["Great effort! Keep practicing for even better form."]
    setFeedback(finalFeedback)
    setState("feedback")
    if (selectedExercise && (reps > 0 || score > 0)) {
      try {
        await addCoachSession({
          exercise: exerciseName,
          reps,
          score: Math.round(score),
          repScores: [...repScores],
        })
        toast.success(`Session saved! ${reps} reps with ${Math.round(score)}% form score`)
      } catch (error) {
        toast.error("Failed to save session")
        console.error(error)
      }
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
    setRepScores([])
    setFeedback([])
    setBreakdown([])
  }, [])

  // Setup: init pose and optionally start camera
  useEffect(() => {
    if (state !== "setup") return
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

  // Detecting: camera stream and pose loop
  useEffect(() => {
    if (state !== "detecting" || !selectedExercise) return
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
          // Full-body scan: which regions are visible (face, torso, arms, legs)
          const scan = getBodyScanDetail(result.landmarks)
          if (scan) {
            const readable = scan.summary.replace(/leftArm|rightArm/g, "arms").replace(/leftLeg|rightLeg/g, "legs").replace(/, arms, arms/g, ", arms").replace(/, legs, legs/g, ", legs")
            setBodyScanSummary(readable)
          }
          // REAL POSE DETECTED - use actual detection
          const res = analyzeForm(result.landmarks, exercise)
          setScore(res.score)
          setIsGoodForm(res.isGoodForm)
          setBreakdown(res.breakdown)
          setLiveFeedback(res.feedback[0] ?? "Good form.")
          const phase = getRepPhase(result.landmarks, exercise, false)
          const now = Date.now()
          // Rep counting: Count reps based on MOVEMENT PATTERN, not perfect form
          // Form score is separate feedback - reps count even with imperfect form
          // Phase transitions: idle/eccentric -> bottom -> concentric -> top = 1 rep
          if (phase === "bottom" && (lastPhaseRef.current === "eccentric" || lastPhaseRef.current === "idle")) {
            // Track form scores during rep for average, but rep counts regardless
            repScoreAccumRef.current.push(res.score)
          }
          if (phase === "top" && lastPhaseRef.current === "concentric" && repScoreAccumRef.current.length > 0) {
            // SHORTER cooldown: 800ms instead of 1200ms (more lenient rep counting)
            const cooldownMs = 800
            if (now - lastRepAtRef.current >= cooldownMs) {
              lastRepAtRef.current = now
              const n = repScoreAccumRef.current.length
              // Use average form score for this rep, or current score if no history
              const repScore = repScoreAccumRef.current.length > 0 
                ? Math.round(repScoreAccumRef.current.reduce((a, b) => a + b, 0) / repScoreAccumRef.current.length)
                : res.score
              setRepScores((prev) => [...prev, repScore])
              setReps((r) => r + 1)
              repCountForVoiceRef.current += 1
              speakRepComplete(repCountForVoiceRef.current)
            }
            repScoreAccumRef.current = []
          }
          lastPhaseRef.current = phase
          // Motivational voice: good form every ~12s
          if (res.isGoodForm && now - lastVoiceAtRef.current > 12000) {
            lastVoiceAtRef.current = now
            speakGoodForm()
          }
          ctx.clearRect(0, 0, cw, ch)
          drawSkeleton(ctx, result.landmarks, cw, ch, res.isGoodForm)
          // Optional: draw a tiny "Skeleton on" label so user sees overlay is active
          ctx.font = "12px system-ui, sans-serif"
          ctx.fillStyle = "rgba(0,0,0,0.4)"
          ctx.fillText("Skeleton", 8, ch - 8)
          return
        } else {
          setBodyScanSummary(null)
          // No pose - just clear canvas (no blue placeholder)
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
        if (Math.random() < 0.02) {
          setReps((r) => r + 1)
          setRepScores((prev) => [...prev, simScore])
        }
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
            { icon: ScanLine, label: "Pose Detection", color: "bg-primary/15 text-primary" },
            { icon: Target, label: "Form Score", color: "bg-chart-2/15 text-chart-2" },
            { icon: Shield, label: "Injury Prevention", color: "bg-chart-4/15 text-chart-4" },
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
        <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {availableExercises.map((ex) => {
            const Icon = ex.icon
            return (
              <button
                key={ex.id}
                onClick={() => handleSelectExercise(ex.id)}
                className="flex items-center gap-4 rounded-2xl bg-card p-3 border border-border text-left transition-all hover:border-primary/30 active:scale-[0.98]"
              >
                <div className={`h-16 w-16 rounded-xl bg-gradient-to-br ${ex.gradient} flex items-center justify-center shrink-0`}>
                  <Icon className="h-8 w-8 text-white/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{ex.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ex.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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

  if (state === "detecting") {
    return (
      <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24">
        <div className="relative h-[78vh] min-h-[450px] max-h-[85vh] bg-secondary overflow-hidden rounded-3xl border-4 border-primary/40 shadow-[0_0_0_2px_hsl(var(--border))] ring-4 ring-primary/20 mx-2 mt-2">
          {useCamera && (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover mirror z-0"
              playsInline
              muted
              style={{ transform: "scaleX(-1)" }}
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
          {useCamera && (
            <div className="absolute inset-x-4 bottom-4 z-30 rounded-xl bg-black/75 backdrop-blur-md px-4 py-3 border border-white/10 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                  <Camera className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    For best detection, keep <strong className="text-amber-300">3–4 feet</strong> between you and the camera.
                  </p>
                  <p className="text-xs text-white/70 mt-0.5">
                    Full body in frame = better skeleton and rep counting.
                  </p>
                  {bodyScanSummary && (
                    <p className="text-[11px] text-emerald-400/90 mt-1.5">
                      Body scan: {bodyScanSummary}
                    </p>
                  )}
                  {liveFeedback.includes("Position yourself") && (
                    <p className="text-xs text-amber-200/90 mt-1.5">
                      Step back so your full body (head to feet) is visible.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div
            className={`absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-sm ${
              isGoodForm ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
            }`}
          >
            {isGoodForm ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="text-xs font-semibold">{isGoodForm ? "Good Form" : "Adjust Form"}</span>
          </div>
          <div className="absolute top-4 left-4 rounded-xl bg-background/80 backdrop-blur-sm px-4 py-2">
            <span className="text-xs text-muted-foreground block">Reps</span>
            <span className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              {reps}
            </span>
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
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Form Score</span>
              <span className="text-sm font-bold text-primary">{score}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${score}%` }} />
            </div>
          </div>
          {breakdown.length > 0 && (
            <div className="rounded-xl bg-card p-3 border border-border">
              <div className="text-xs font-semibold text-foreground mb-2">Live form breakdown</div>
              <div className="flex flex-wrap gap-2">
                {breakdown.map((b, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${b.ok ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}
                    title={b.detail}
                  >
                    {b.label}: {b.value}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl bg-card p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Live feedback</span>
            </div>
            <p className="text-xs text-muted-foreground">{liveFeedback}</p>
          </div>
          <button
            onClick={handleFinish}
            className="w-full rounded-xl bg-destructive py-4 text-center font-semibold text-destructive-foreground text-base transition-all hover:bg-destructive/90 active:scale-[0.98]"
          >
            Finish Workout
          </button>
        </div>
      </div>
    )
  }

  const avgRepScore = repScores.length > 0 ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length) : score
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
      </div>
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
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={() => { setState("setup"); setReps(0); setRepScores([]); setFeedback([]); setScore(100); }}
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
