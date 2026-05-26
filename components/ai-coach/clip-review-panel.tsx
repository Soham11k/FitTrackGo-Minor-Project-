"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Loader2, AlertCircle } from "lucide-react"
import { sampleFramesFromBlob, sampleFramesPerRep } from "@/lib/coach-replay/sample-frames"
import {
  migrateClipReviewResult,
  type ClipReviewResult,
  type RepCoachFeedback,
} from "@/lib/ai-coach/clip-review"
import { buildLocalRepFeedback, mergeFaultsFromTrace } from "@/lib/ai-coach/rep-feedback-local"
import type { RepTracePair } from "@/lib/rep-trace"
import { RepFeedbackCard } from "@/components/ai-coach/rep-feedback-card"
import { toast } from "sonner"

export interface ClipReviewPanelProps {
  sessionId: string
  exerciseId: string
  exerciseName: string
  clipBlob?: Blob | null
  loadKg?: number
  reps: Array<{ index: number; score: number; faults: string[] }>
  repMarkersMs?: number[]
  clipDurationMs?: number
  repTraces?: RepTracePair[]
  /** Controlled rep selection (replay sheet + panel stay in sync). */
  selectedRepIndex?: number | null
  onSelectedRepChange?: (repIndex: number) => void
  onHighlightChange?: (repIndex: number) => void
}

const STORAGE_PREFIX = "ft-clip-review-"

function readCached(sessionId: string, repCount: number): ClipReviewResult | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`)
    if (!raw) return null
    return migrateClipReviewResult(JSON.parse(raw), repCount)
  } catch {
    return null
  }
}

function writeCached(sessionId: string, result: ClipReviewResult): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, JSON.stringify(result))
  } catch {
    /* ignore */
  }
}

export function ClipReviewPanel({
  sessionId,
  exerciseId,
  exerciseName,
  clipBlob,
  loadKg,
  reps,
  repMarkersMs,
  clipDurationMs,
  repTraces,
  selectedRepIndex: selectedRepIndexProp,
  onSelectedRepChange,
  onHighlightChange,
}: ClipReviewPanelProps) {
  const repCount = reps.length
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ClipReviewResult | null>(() => readCached(sessionId, repCount))
  const [error, setError] = useState<string | null>(null)
  const [selectedRepIndexInternal, setSelectedRepIndexInternal] = useState<number | null>(null)

  const selectedRepIndex =
    selectedRepIndexProp !== undefined ? selectedRepIndexProp : selectedRepIndexInternal

  const setSelectedRepIndex = (idx: number) => {
    if (onSelectedRepChange) onSelectedRepChange(idx)
    else setSelectedRepIndexInternal(idx)
    onHighlightChange?.(idx)
  }

  const localPerRep = useMemo(
    () =>
      buildLocalRepFeedback(
        repCount,
        repTraces ?? [],
        reps.map((r) => r.score),
        exerciseId,
      ),
    [repCount, repTraces, reps, exerciseId],
  )

  const displayPerRep: RepCoachFeedback[] = result?.perRep?.length ? result.perRep : localPerRep

  useEffect(() => {
    if (!result) {
      if (repCount > 0) setSelectedRepIndex(0)
      return
    }
    const idx = result.highlightRepIndex
    setSelectedRepIndex(idx >= 0 && idx < repCount ? idx : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, repCount])

  const canRun = useMemo(() => !!clipBlob && repCount > 0 && !busy, [clipBlob, repCount, busy])

  const repFocusIdx =
    selectedRepIndex != null && selectedRepIndex >= 0
      ? selectedRepIndex
      : result?.highlightRepIndex ?? 0

  const repFocusFeedback = useMemo(() => {
    if (repFocusIdx < 0 || repFocusIdx >= displayPerRep.length) return null
    return displayPerRep[repFocusIdx] ?? null
  }, [displayPerRep, repFocusIdx])

  const onDeviceForFocus = useMemo(() => {
    const trace = repTraces?.find((t) => t.rep === repFocusIdx + 1)
    return mergeFaultsFromTrace(trace)
  }, [repTraces, repFocusIdx])

  async function runReview() {
    if (!clipBlob) {
      toast.error("No clip available for this session")
      return
    }
    setBusy(true)
    setError(null)
    try {
      let frames =
        repMarkersMs && repMarkersMs.length >= 1
          ? await sampleFramesPerRep(clipBlob, repMarkersMs, clipDurationMs ?? 0, {
              framesPerRep: 2,
              maxTotal: 14,
              maxSide: 512,
              quality: 0.72,
            })
          : await sampleFramesFromBlob(clipBlob, {
              count: 14,
              maxSide: 512,
              quality: 0.72,
              minFrames: 2,
            })

      if (frames.length < 2) {
        frames = await sampleFramesFromBlob(clipBlob, {
          count: 8,
          maxSide: 400,
          quality: 0.65,
          minFrames: 2,
        })
      }
      if (frames.length === 1) {
        const only = frames[0]!
        frames = [only, { ...only, timestampMs: only.timestampMs + 33 }]
      }
      if (frames.length < 1) {
        throw new Error(
          "Couldn't read frames from this clip. Try replaying the set with a longer recording, or re-record with the camera preview steady first.",
        )
      }

      const res = await fetch("/api/ai-coach/review-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          exerciseId,
          exerciseName,
          loadKg,
          repCount,
          reps,
          frames,
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`Server ${res.status}: ${t.slice(0, 200)}`)
      }
      const payload = migrateClipReviewResult(await res.json(), repCount)
      if (!payload) throw new Error("Invalid review response")
      setResult(payload)
      writeCached(sessionId, payload)
      toast.success("Review ready")
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error("Couldn't generate review", { description: msg.slice(0, 80) })
    } finally {
      setBusy(false)
    }
  }

  const repChips = (
    <div className="flex flex-wrap gap-1.5">
      {displayPerRep.map((r) => {
        const isSelected = r.repIndex === repFocusIdx
        const isModelHighlight = result != null && r.repIndex === result.highlightRepIndex
        const scoreLabel =
          typeof r.score === "number" ? `, form ${r.score}%` : typeof reps[r.repIndex]?.score === "number" ? `, form ${reps[r.repIndex]!.score}%` : ""
        return (
          <button
            key={r.repIndex}
            type="button"
            onClick={() => setSelectedRepIndex(r.repIndex)}
            title={
              isModelHighlight
                ? `Focal rep for AI review${scoreLabel}`
                : `Rep ${r.repIndex + 1} feedback${scoreLabel}`
            }
            aria-label={`Rep ${r.repIndex + 1}${scoreLabel}`}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground/80 hover:bg-muted/60"
            } ${isModelHighlight && !isSelected ? "ring-1 ring-primary/40" : ""}`}
          >
            Rep {r.repIndex + 1}
            {isModelHighlight ? " ★" : ""}
          </button>
        )
      })}
    </div>
  )

  if (!result) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Per-rep coaching
        </div>
        <p className="text-xs text-muted-foreground">
          On-device notes below update as you select each rep. Tap Get AI review for vision-backed good / improve
          cues (needs <code className="rounded bg-muted px-1 text-[10px]">OPENAI_API_KEY</code> on the server).
        </p>
        {repChips}
        {repFocusFeedback ? (
          <RepFeedbackCard
            feedback={repFocusFeedback}
            source="local"
            onDeviceImprove={onDeviceForFocus}
          />
        ) : null}
        <button
          type="button"
          onClick={() => void runReview()}
          disabled={!canRun}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {busy ? "Reviewing…" : "Get AI review"}
        </button>
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        Per-rep coaching
      </div>
      {result.summary ? (
        <p className="text-sm text-foreground/90 leading-relaxed">{result.summary}</p>
      ) : null}
      {result.topThreeFixes.length > 0 ? (
        <div>
          <div className="text-typo-eyebrow font-semibold uppercase text-muted-foreground">Top fixes (whole set)</div>
          <ul className="mt-1 space-y-1">
            {result.topThreeFixes.map((fix, i) => (
              <li key={i} className="text-sm text-foreground/90 leading-snug">
                • {fix}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {displayPerRep.length > 0 ? (
        <div className="space-y-2">
          {repChips}
          {repFocusFeedback ? (
            <RepFeedbackCard
              feedback={repFocusFeedback}
              source="ai"
              onDeviceImprove={onDeviceForFocus}
            />
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void runReview()}
        disabled={!canRun}
        className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
      >
        Re-run AI review
      </button>
    </motion.div>
  )
}
