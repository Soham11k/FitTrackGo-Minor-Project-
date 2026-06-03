"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader2, Send } from "lucide-react"
import { CHROME } from "@/lib/app-chrome"
import { CHROME_ACCENT } from "@/lib/chrome-accent"
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
  /** Dark coach mock styling for complete / live screens. */
  variant?: "default" | "coach-dark"
}

export function AICoachLlmPanel(props: Props) {
  const sessionPhase = props.sessionPhase ?? "completed"
  const dark = props.variant === "coach-dark"
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
    <div
      className={`w-full space-y-3 rounded-2xl border p-4 ${
        dark ? "" : "max-w-sm border-border bg-card"
      }`}
      style={
        dark
          ? {
              backgroundColor: CHROME.homeCard,
              borderColor: CHROME.border,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: dark ? CHROME_ACCENT.accent : undefined }} aria-hidden />
          <span
            className={`text-sm font-semibold ${dark ? "text-white" : "text-foreground"}`}
            style={dark ? { fontFamily: CHROME.homeLabelFont } : undefined}
          >
            Ask the coach
          </span>
        </div>
        {dark ? (
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white"
            style={{ backgroundColor: CHROME_ACCENT.accent, fontFamily: CHROME.homeLabelFont }}
          >
            AI
          </span>
        ) : null}
      </div>
      <p
        className={`text-typo-caption leading-snug ${dark ? "text-white/45" : "text-muted-foreground"}`}
        style={dark ? { fontFamily: CHROME.homeBodyFont, fontSize: "12px" } : undefined}
      >
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
        className={`min-h-[72px] resize-none text-sm ${dark ? "border-white/10 bg-black/30 text-white placeholder:text-white/30" : ""}`}
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
        className={`w-full gap-2 ${dark ? "bg-white text-black hover:bg-white/90" : ""}`}
        onClick={() => void ask()}
        disabled={loading || aiEnabled === false || !q.trim() || aiEnabled === null}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {loading ? "Thinking…" : "Ask"}
      </Button>
      {err && <p className={`text-xs ${dark ? "text-red-400" : "text-destructive"}`}>{err}</p>}
      {answer && (
        <div
          className={`whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed ${
            dark ? "border-white/10 bg-black/25 text-white/90" : "border-border/60 bg-secondary/40 text-foreground"
          }`}
        >
          {answer}
        </div>
      )}
    </div>
  )
}
