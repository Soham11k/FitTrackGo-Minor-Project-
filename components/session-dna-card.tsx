"use client"

import { useRef } from "react"
import { Share2, Download } from "lucide-react"
import { RingGauge } from "@/components/ring-gauge"

export interface SessionDnaProps {
  exercise: string
  reps: number
  score: number
  repScores: number[]
  effectiveReps: number
  verifiedMovement: boolean
  faceVerifiedSession: boolean
}

export function SessionDnaCard(props: SessionDnaProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const avgRep = props.repScores.length
    ? Math.round(props.repScores.reduce((a, b) => a + b, 0) / props.repScores.length)
    : props.score

  async function shareSummary() {
    const text = `FitTrack Go — ${props.exercise}: ${props.reps} reps (${props.effectiveReps.toFixed(1)} effective) · ${props.score}% form${props.verifiedMovement ? " · Verified movement" : ""}`
    try {
      if (navigator.share) {
        await navigator.share({ title: "My coach session", text })
        return
      }
    } catch { /* user cancel */ }
    try {
      await navigator.clipboard.writeText(text)
    } catch { /* noop */ }
  }

  function downloadPng() {
    const el = cardRef.current
    if (!el) return
    // Canvas export (no extra dependency)
    const w = 340
    const h = 200
    const canvas = document.createElement("canvas")
    canvas.width = w * 2
    canvas.height = h * 2
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(2, 2)
    const hue = (props.score / 100) * 120
    ctx.fillStyle = `hsl(${hue}, 40%, 12%)`
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = `hsl(${hue}, 70%, 55%)`
    ctx.lineWidth = 2
    ctx.strokeRect(8, 8, w - 16, h - 16)
    ctx.fillStyle = "#fff"
    ctx.font = "bold 16px system-ui"
    ctx.fillText("Session DNA", 20, 32)
    ctx.font = "13px system-ui"
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fillText(props.exercise, 20, 54)
    ctx.fillText(`Reps ${props.reps} · Effective ${props.effectiveReps.toFixed(1)}`, 20, 74)
    ctx.fillText(`Form ${props.score}% · Avg rep ${avgRep}%`, 20, 94)
    const flags = [
      props.verifiedMovement ? "Verified movement" : null,
      props.faceVerifiedSession ? "Face-verified" : null,
    ].filter(Boolean).join(" · ")
    if (flags) ctx.fillText(flags, 20, 114)

    const maxBar = Math.max(...props.repScores, 1)
    const barW = (w - 40) / Math.max(props.repScores.length, 1)
    props.repScores.slice(0, 24).forEach((s, i) => {
      const bh = ((s / maxBar) * 56) | 0
      ctx.fillStyle = `hsl(${(s / 100) * 120}, 70%, 50%)`
      ctx.fillRect(20 + i * barW, 170 - bh, Math.max(2, barW - 2), bh)
    })

    const a = document.createElement("a")
    a.download = `fittrack-session-${Date.now()}.png`
    a.href = canvas.toDataURL("image/png")
    a.click()
  }

  const scoreTint =
    props.score >= 80
      ? "stroke-metric-move"
      : props.score >= 60
        ? "stroke-metric-streak"
        : "stroke-destructive"
  const scoreFg =
    props.score >= 80
      ? "text-metric-move"
      : props.score >= 60
        ? "text-metric-streak"
        : "text-destructive"

  return (
    <div ref={cardRef} className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Session DNA</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={shareSummary}
            className="p-2 rounded-lg bg-secondary text-secondary-foreground active:scale-95 transition-transform"
            aria-label="Share summary"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="p-2 rounded-lg bg-secondary text-secondary-foreground active:scale-95 transition-transform"
            aria-label="Download card image"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <RingGauge
            value={props.score}
            max={100}
            size={96}
            thickness={10}
            progressClassName={scoreTint}
            spring
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums ${scoreFg}`}>{props.score}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Form
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-snug">
            Form-weighted reps and per-rep quality — shareable summary.
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-secondary/50 py-1.5">
              <div className="text-base font-bold tabular-nums text-foreground">{props.reps}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Reps</div>
            </div>
            <div className="rounded-lg bg-metric-move/10 py-1.5">
              <div className="text-base font-bold tabular-nums text-metric-move">{props.effectiveReps.toFixed(1)}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Eff.</div>
            </div>
            <div className="rounded-lg bg-metric-coach/10 py-1.5">
              <div className="text-base font-bold tabular-nums text-metric-coach">{avgRep}%</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Avg</div>
            </div>
          </div>
        </div>
      </div>

      {(props.verifiedMovement || props.faceVerifiedSession) && (
        <div className="flex flex-wrap gap-2">
          {props.verifiedMovement && (
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] rounded-full bg-metric-move/15 text-metric-move px-2 py-0.5">
              Verified movement
            </span>
          )}
          {props.faceVerifiedSession && (
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] rounded-full bg-metric-spo2/15 text-metric-spo2 px-2 py-0.5">
              Face-verified
            </span>
          )}
        </div>
      )}

      {props.repScores.length > 0 && (
        <div className="flex items-end gap-0.5 h-14 pt-2 border-t border-border">
          {props.repScores.slice(0, 32).map((s, i) => {
            const barTint =
              s >= 80 ? "bg-metric-move" : s >= 60 ? "bg-metric-streak" : "bg-destructive"
            return (
              <div
                key={i}
                className={`flex-1 min-w-[3px] rounded-t-sm ${barTint}`}
                style={{
                  height: `${Math.max(8, (s / 100) * 100)}%`,
                  opacity: 0.55 + (s / 100) * 0.45,
                }}
                title={`Rep ${i + 1}: ${s}%`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
