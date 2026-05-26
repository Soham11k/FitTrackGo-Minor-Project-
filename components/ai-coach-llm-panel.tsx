"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { FormBreakdown } from "@/lib/form-analysis"

type SessionDnaSummary = {
  effectiveReps: number
  verifiedMovement: boolean
  faceVerifiedSession: boolean
}

type RepScoreStats = { min: number; max: number; avg: number }

type Props = {
  exerciseId: string
  exerciseName: string
  reps: number
  score: number
  repScores: number[]
  feedback: string[]
  breakdown: FormBreakdown[]
  exerciseTips: string[]
  sessionDnaSummary: SessionDnaSummary | null
  repScoreStats: RepScoreStats | null
  /** Current live feedback line when session is in progress. */
  liveCue?: string | null
  /** live = mid-session; completed = post-session summary. */
  sessionPhase?: "live" | "completed"
}

export function AICoachLlmPanel(props: Props) {
  const sessionPhase = props.sessionPhase ?? "completed"
  const [q, setQ] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/ai-coach/chat")
      .then((r) => r.json() as Promise<{ enabled?: boolean }>)
      .then((data) => {
        if (!cancelled) setAiEnabled(!!data.enabled)
      })
      .catch(() => {
        if (!cancelled) setAiEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ask = async () => {
    const message = q.trim()
    if (!message || loading) return
    setLoading(true)
    setErr(null)
    setAnswer(null)
    try {
      const res = await fetch("/api/ai-coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          session: {
            exerciseId: props.exerciseId,
            exerciseName: props.exerciseName,
            reps: props.reps,
            score: props.score,
            repScores: props.repScores,
            feedback: props.feedback,
            breakdown: props.breakdown.map((b) => ({
              label: b.label,
              value: b.value,
              ok: b.ok,
              detail: b.detail,
              region: b.region,
            })),
            repScoreStats: props.repScoreStats ?? undefined,
            sessionDna: props.sessionDnaSummary ?? undefined,
            exerciseTips: props.exerciseTips.length ? props.exerciseTips : undefined,
            sessionPhase,
            ...(sessionPhase === "live" && props.liveCue?.trim()
              ? { liveCue: props.liveCue.trim() }
              : {}),
          },
        }),
      })
      const data = (await res.json()) as { answer?: string; message?: string; error?: string }
      if (!res.ok) {
        setErr(data.message ?? data.error ?? "Could not get a response.")
        return
      }
      if (data.answer) setAnswer(data.answer)
      else setErr("Empty response.")
    } catch {
      setErr("Network error. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Ask the coach (AI)</span>
      </div>
      <p className="text-typo-caption text-muted-foreground leading-snug">
        {aiEnabled === null && "Checking AI coach…"}
        {aiEnabled === true &&
          (sessionPhase === "live"
            ? "Uses your current live scores, form breakdown, and the cue under Live feedback—plus in-app knowledge. Metrics update as you move. Video stays on your device; only text and numbers are sent."
            : "Uses your session summary (scores, form breakdown, session DNA, exercise tips) plus retrieved in-app knowledge. Video stays on your device—only text/numbers are sent.")}
        {aiEnabled === false && (
          <>
            To enable answers, set{" "}
            <code className="text-typo-eyebrow bg-secondary px-1 rounded">OPENAI_API_KEY</code> on the server
            (e.g. <code className="text-typo-eyebrow bg-secondary px-1 rounded">.env.local</code> and restart, or your host’s env
            variables). RAG still uses the same in-app knowledge once enabled.
          </>
        )}
      </p>
      <Textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          sessionPhase === "live"
            ? "e.g. What should I fix right now? Any cue for my next rep?"
            : "e.g. Why was my score lower on later reps?"
        }
        className="min-h-[72px] text-sm resize-none"
        maxLength={600}
        disabled={loading || aiEnabled === false}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            void ask()
          }
        }}
      />
      <Button
        type="button"
        className="w-full gap-2"
        onClick={() => void ask()}
        disabled={loading || aiEnabled === false || !q.trim() || aiEnabled === null}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {loading ? "Thinking…" : "Ask"}
      </Button>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {answer && (
        <div className="rounded-lg bg-secondary/40 border border-border/60 p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  )
}
