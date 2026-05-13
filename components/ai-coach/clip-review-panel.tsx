"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Loader2, AlertCircle } from "lucide-react"
import { sampleFramesFromBlob } from "@/lib/coach-replay/sample-frames"
import type { ClipReviewResult } from "@/lib/ai-coach/clip-review"
import { toast } from "sonner"

export interface ClipReviewPanelProps {
  sessionId: string
  exerciseId: string
  exerciseName: string
  clipBlob?: Blob | null
  loadKg?: number
  reps: Array<{ index: number; score: number; faults: string[] }>
  /** Called when the review's highlightRepIndex changes so the parent can scrub. */
  onHighlightChange?: (repIndex: number) => void
}

const STORAGE_PREFIX = "ft-clip-review-"

function readCached(sessionId: string): ClipReviewResult | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`)
    return raw ? (JSON.parse(raw) as ClipReviewResult) : null
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
  onHighlightChange,
}: ClipReviewPanelProps) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ClipReviewResult | null>(() => readCached(sessionId))
  const [error, setError] = useState<string | null>(null)
  const repCount = reps.length

  useEffect(() => {
    if (result && onHighlightChange) onHighlightChange(result.highlightRepIndex)
  }, [result, onHighlightChange])

  const canRun = useMemo(() => !!clipBlob && repCount > 0 && !busy, [clipBlob, repCount, busy])

  async function runReview() {
    if (!clipBlob) {
      toast.error("No clip available for this session")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const frames = await sampleFramesFromBlob(clipBlob, { count: 40, maxSide: 480, quality: 0.7 })
      if (frames.length < 3) throw new Error("Couldn't read enough frames")
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
      const payload = (await res.json()) as ClipReviewResult
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

  if (!result) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          AI review
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Get a frame-by-frame breakdown of this set. Uses your saved video clip and per-rep scores.
        </p>
        <button
          type="button"
          onClick={() => void runReview()}
          disabled={!canRun}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {busy ? "Reviewing…" : "Get AI review"}
        </button>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        AI review
      </div>
      {result.summary && (
        <p className="text-sm text-foreground/90 leading-relaxed">{result.summary}</p>
      )}
      {result.topThreeFixes.length > 0 && (
        <div>
          <div className="text-typo-eyebrow font-semibold uppercase text-muted-foreground">Top fixes</div>
          <ul className="mt-1 space-y-1">
            {result.topThreeFixes.map((fix, i) => (
              <li key={i} className="text-sm text-foreground/90 leading-snug">• {fix}</li>
            ))}
          </ul>
        </div>
      )}
      {result.perRepFaults.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.perRepFaults.map((r) => (
            <button
              key={r.repIndex}
              type="button"
              onClick={() => onHighlightChange?.(r.repIndex)}
              className={`rounded-full border px-2 py-0.5 text-xs tabular-nums ${
                r.repIndex === result.highlightRepIndex
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground/80"
              }`}
            >
              R{r.repIndex + 1} · {r.score}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
