"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Lock } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { drawSkeleton } from "@/lib/pose-detection"
import type { LandmarkPoint } from "@/lib/pose-detection"
import {
  getCoachReplayMetaByClipId,
  getCoachReplayMetaBySessionId,
  getCoachReplayVideoBlob,
} from "@/lib/coach-replay/store"
import type { CoachReplayMeta, LandmarkSnapshot } from "@/lib/coach-replay/types"
import { ClipReviewPanel } from "@/components/ai-coach/clip-review-panel"
import { buildHighlightSegment } from "@/lib/coach-replay/highlight"
import type { RepTracePair } from "@/lib/rep-trace"
import { getSpecIdForStep } from "@/lib/exercise-ai-map"
import { isCoachClipCloudSyncEnabled } from "@/lib/coach-replay/prefs"
import { fetchAndDecryptCoachClip, getClipSignedUrl } from "@/lib/coach-clips-supabase"
import { ClipKeyMissingError } from "@/lib/encryption/content-key"
import { fetchUserClipKeyRow } from "@/lib/user-clip-keys-supabase"
import { PassphraseUnlockDialog } from "@/components/encryption/passphrase-unlock"
import { CueFocusProvider } from "@/components/coach/cue-focus-context"
import { drawCueFocusOverlay } from "@/lib/coach-vision/canvas-highlight"
import type { HighlightSpec } from "@/lib/coach-vision/cue-resolver"
import { useReducedMotion } from "framer-motion"
import type { Landmark } from "@/lib/form-analysis"
import { getObjectFitContentRect } from "@/lib/video-overlay-layout"
import { COACH_FRAME_INTERVAL_MS } from "@/lib/pose-config"

function snapshotsToLm(s: LandmarkSnapshot): LandmarkPoint[] {
  const out: LandmarkPoint[] = []
  for (let i = 0; i < 33; i++) {
    const p = s.lm[i]
    out.push({
      x: p?.x ?? 0.5,
      y: p?.y ?? 0.5,
      z: p?.z,
      visibility: p?.visibility,
    } as LandmarkPoint)
  }
  return out
}

function pickSnapshot(frames: LandmarkSnapshot[], videoTimeMs: number, durationMs: number): LandmarkSnapshot | null {
  if (!frames.length) return null
  const target =
    durationMs > 250 && frames[frames.length - 1]!.tMs > 0
      ? (videoTimeMs / Math.max(durationMs, 1)) * frames[frames.length - 1]!.tMs
      : videoTimeMs

  let best = frames[0]!
  let bestD = Math.abs(best.tMs - target)
  for (const f of frames) {
    const d = Math.abs(f.tMs - target)
    if (d < bestD) {
      best = f
      bestD = d
    }
  }
  return best
}

export function CoachReplaySheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId?: string | null
  clipId?: string | null
  /** Per-rep summaries used by the AI review panel. */
  reps?: Array<{ index: number; score: number; faults: string[] }>
  /** On-device bottom/top traces for instant per-rep notes. */
  repTraces?: RepTracePair[]
  /** External load lifted on this set, when applicable. */
  loadKg?: number
}) {
  const { open, onOpenChange, sessionId, clipId, reps, repTraces, loadKg } = props
  const [selectedRepIndex, setSelectedRepIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [overlay, setOverlay] = useState(true)
  const [meta, setMeta] = useState<CoachReplayMeta | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [encryptedReplay, setEncryptedReplay] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [cueHighlight, setCueHighlight] = useState<HighlightSpec | null>(null)
  const reduceMotion = useReducedMotion() ?? false

  const exerciseId =
    meta?.exerciseId ||
    (meta?.exerciseLabel && getSpecIdForStep(meta.exerciseLabel)) ||
    "unknown"

  const drawFrame = useCallback(() => {
    const v = videoRef.current
    const c = canvasRef.current
    if (!meta || !v || !c || !overlay) return
    const ctx = c.getContext("2d")
    if (!ctx) return

    const containerW = Math.max(1, v.clientWidth || 640)
    const containerH = Math.max(1, v.clientHeight || 480)
    const mediaW = Math.max(1, v.videoWidth || containerW)
    const mediaH = Math.max(1, v.videoHeight || containerH)

    c.width = containerW
    c.height = containerH
    ctx.clearRect(0, 0, containerW, containerH)

    const tMs = Math.max(0, v.currentTime * 1000)
    const snap = pickSnapshot(meta.landmarkFrames, tMs, meta.durationMs)
    if (!snap) return

    const lm = snapshotsToLm(snap)
    const faultPairs = cueHighlight?.kind === "improve" ? cueHighlight.segmentPairs : []
    const rect = getObjectFitContentRect(containerW, containerH, mediaW, mediaH, "cover")

    ctx.save()
    ctx.translate(rect.x, rect.y)
    drawSkeleton(ctx, lm, rect.w, rect.h, true, undefined, 88, faultPairs)
    if (cueHighlight) {
      drawCueFocusOverlay(ctx, lm as unknown as Landmark[], cueHighlight, rect.w, rect.h, reduceMotion)
    }
    ctx.restore()
  }, [meta, overlay, cueHighlight, reduceMotion])

  useEffect(() => {
    let revoke: string | null = null
    if (!open) return
    setErr(null)
    setMeta(null)
    setUnlockOpen(false)
    setEncryptedReplay(false)
    ;(async () => {
      const m =
        (sessionId && (await getCoachReplayMetaBySessionId(sessionId))) ||
        (clipId && (await getCoachReplayMetaByClipId(clipId))) ||
        null
      if (!m) {
        setErr("Replay not available on this device (clip was cleared or never recorded).")
        return
      }
      let blob = await getCoachReplayVideoBlob(m)
      let wasEnc = false
      if (!blob && m.sessionId && isCoachClipCloudSyncEnabled()) {
        const url = await getClipSignedUrl(m.sessionId)
        if (url) {
          try {
            const out = await fetchAndDecryptCoachClip(url)
            blob = out.blob
            wasEnc = out.wasEncrypted
          } catch (e) {
            if (e instanceof ClipKeyMissingError) {
              const remote = await fetchUserClipKeyRow()
              if (!remote) {
                setErr(
                  "This clip is encrypted in the cloud, but this browser has no decryption key and no passphrase backup was saved. Re-record on this device or restore from a browser that still has the key.",
                )
              } else {
                setUnlockOpen(true)
              }
              setMeta(m)
              setVideoBlob(null)
              setVideoUrl(null)
              return
            }
            console.warn(e)
            setErr("Could not download clip from cloud.")
            setMeta(m)
            setVideoBlob(null)
            setVideoUrl(null)
            return
          }
        }
      }
      if (!blob) {
        setErr("Video file missing — skeleton-only replay.")
        setMeta(m)
        setVideoBlob(null)
        setVideoUrl(null)
        return
      }
      const url = URL.createObjectURL(blob)
      revoke = url
      setVideoUrl(url)
      setVideoBlob(blob)
      setMeta(m)
      setEncryptedReplay(wasEnc)
    })().catch(() => setErr("Could not load replay data."))

    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
      setVideoUrl(null)
    }
  }, [open, sessionId, clipId, reloadToken])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !videoUrl) return
    v.src = videoUrl
    v.load()
    void v.play().catch(() => {})
  }, [videoUrl])

  useEffect(() => {
    if (!open || !overlay) return
    let raf = 0
    let lastDraw = 0
    const loop = (t: number) => {
      if (t - lastDraw >= COACH_FRAME_INTERVAL_MS) {
        lastDraw = t
        drawFrame()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [drawFrame, overlay, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <CueFocusProvider
        exerciseId={exerciseId}
        onHighlightChange={setCueHighlight}
      >
      <SheetContent side="bottom" className="max-h-[90vh] rounded-t-3xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            Set replay
            {encryptedReplay ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden />
                Encrypted clip
              </span>
            ) : null}
          </SheetTitle>
          <SheetDescription>{meta?.exerciseLabel ?? "Coach session replay with pose overlay."}</SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-3 px-2 pb-6">
          {err ? <p className="text-sm text-destructive">{err}</p> : null}

          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Pose overlay</span>
            <Switch checked={overlay} onCheckedChange={setOverlay} />
          </div>

          <div className="relative w-full rounded-xl bg-black overflow-hidden aspect-video border border-border">
            {videoUrl ? (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                playsInline
                controls
                style={{ transform: "scaleX(-1)" }}
                onLoadedMetadata={() => drawFrame()}
                onSeeked={() => drawFrame()}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground px-4 text-center">
                {meta && !videoUrl ? "No WebM clip — overlays use saved joint samples only." : "Loading…"}
              </div>
            )}
            {overlay ? (
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                style={{ transform: "scaleX(-1)", zIndex: 10 }}
                aria-hidden
              />
            ) : null}
          </div>

          {meta && meta.repMarkersMs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {meta.repMarkersMs.map((ms, i) => (
                <Button
                  key={i}
                  type="button"
                  variant={selectedRepIndex === i ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setSelectedRepIndex(i)
                    const v = videoRef.current
                    if (v && videoUrl) {
                      const seg = buildHighlightSegment(meta.repMarkersMs, i, meta.durationMs)
                      v.currentTime = Math.max(0, (seg?.startMs ?? ms - 400) / 1000)
                    }
                    drawFrame()
                  }}
                >
                  Rep {i + 1}
                </Button>
              ))}
            </div>
          ) : null}

          {sessionId && reps && reps.length > 0 ? (
            <ClipReviewPanel
              sessionId={sessionId}
              exerciseId={exerciseId}
              exerciseName={meta?.exerciseLabel ?? "Exercise"}
              clipBlob={videoBlob}
              loadKg={loadKg}
              reps={reps}
              repTraces={repTraces}
              repMarkersMs={meta?.repMarkersMs}
              clipDurationMs={meta?.durationMs}
              selectedRepIndex={selectedRepIndex}
              onSelectedRepChange={(repIndex) => {
                setSelectedRepIndex(repIndex)
                if (!meta) return
                const seg = buildHighlightSegment(meta.repMarkersMs, repIndex, meta.durationMs)
                const v = videoRef.current
                if (v && seg) v.currentTime = Math.max(0, seg.startMs / 1000)
                drawFrame()
              }}
              onHighlightChange={(repIndex) => {
                if (!meta) return
                const seg = buildHighlightSegment(meta.repMarkersMs, repIndex, meta.durationMs)
                const v = videoRef.current
                if (v && seg) v.currentTime = Math.max(0, seg.startMs / 1000)
                drawFrame()
              }}
            />
          ) : null}
        </div>

        <PassphraseUnlockDialog
          open={unlockOpen}
          onOpenChange={setUnlockOpen}
          onUnlocked={() => setReloadToken((t) => t + 1)}
        />
      </SheetContent>
      </CueFocusProvider>
    </Sheet>
  )
}
