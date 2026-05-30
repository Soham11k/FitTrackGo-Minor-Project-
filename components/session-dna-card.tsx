"use client"

import { Share2, Download } from "lucide-react"
import { toast } from "sonner"
import { RingGauge } from "@/components/ring-gauge"
import { cn } from "@/lib/utils"
import { composeCoachShareFile } from "@/lib/share-card"
import type { MotionDna } from "@/lib/coach-vision/motion-dna"

export interface SessionDnaProps {
  exercise: string
  reps: number
  score: number
  repScores: number[]
  effectiveReps: number
  verifiedMovement: boolean
  faceVerifiedSession: boolean
  /** 6-axis Motion DNA fingerprint computed on session finish */
  motionDna?: MotionDna
  /** Larger ring on coach recap hero */
  ringSize?: number
  className?: string
}

const DNA_AXES = ["Stability", "Range", "Tempo", "Symmetry", "Depth", "Consistency"] as const

function MotionDnaRadar({ dna, size = 96 }: { dna: MotionDna; size?: number }) {
  const half = size / 2
  const step = (Math.PI * 2) / 6
  const gridR = [0.25, 0.5, 0.75, 1]

  const toXY = (v: number, i: number): [number, number] => {
    const theta = -Math.PI / 2 + i * step
    return [half + Math.cos(theta) * v * (half - 6), half + Math.sin(theta) * v * (half - 6)]
  }

  const axes = [dna.stability, dna.range, dna.tempo, dna.symmetry, dna.depth, dna.consistency]
  const pts = axes.map((v, i) => toXY(v, i))
  const polyPath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z"

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Motion DNA radar">
        {/* Grid rings */}
        {gridR.map((r) => {
          const gridPts = Array.from({ length: 6 }, (_, i) => toXY(r, i))
          const gridPath = gridPts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z"
          return <path key={r} d={gridPath} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={0.5} />
        })}
        {/* Axis spokes */}
        {Array.from({ length: 6 }, (_, i) => {
          const [x, y] = toXY(1, i)
          return <line key={i} x1={half} y1={half} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.5} />
        })}
        {/* Data polygon */}
        <path d={polyPath} fill="oklch(var(--primary) / 0.18)" stroke="oklch(var(--primary))" strokeWidth={1.5} strokeLinejoin="round" />
        {/* Data dots */}
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={2} fill="oklch(var(--primary))" />
        ))}
      </svg>
      <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 w-full text-center">
        {DNA_AXES.map((label, i) => (
          <div key={label} className="flex flex-col items-center">
            <span className="text-[10px] font-bold tabular-nums text-primary">{Math.round(axes[i] * 100)}</span>
            <span className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground leading-none">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SessionDnaCard({
  ringSize = 96,
  className,
  exercise,
  reps,
  score,
  repScores,
  effectiveReps,
  verifiedMovement,
  faceVerifiedSession,
  motionDna,
}: SessionDnaProps) {
  const avgRep = repScores.length
    ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length)
    : score

  async function shareSummary() {
    const text = `FitTrack Go — ${exercise}: ${reps} reps (${effectiveReps.toFixed(1)} effective) · ${score}% form${verifiedMovement ? " · Verified movement" : ""}`
    try {
      const file = await composeCoachShareFile({
        exercise,
        reps,
        score,
        effectiveReps,
        repScores,
        verifiedMovement,
        faceVerifiedSession,
      })
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My coach session", text, files: [file] })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: "My coach session", text })
        return
      }
    } catch {
      /* user cancel */
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied session summary")
    } catch {
      /* noop */
    }
  }

  async function downloadPng() {
    const file = await composeCoachShareFile({
      exercise,
      reps,
      score,
      effectiveReps,
      repScores,
      verifiedMovement,
      faceVerifiedSession,
    })
    if (!file) {
      toast.error("Could not render share card")
      return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement("a")
    a.download = file.name
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }

  const scoreTint =
    score >= 80
      ? "stroke-metric-move"
      : score >= 60
        ? "stroke-metric-streak"
        : "stroke-destructive"
  const scoreFg =
    score >= 80
      ? "text-metric-move"
      : score >= 60
        ? "text-metric-streak"
        : "text-destructive"
  const thickness = ringSize >= 108 ? 12 : 10
  const scoreTextClass = ringSize >= 108 ? "text-4xl font-bold tabular-nums" : "text-3xl font-bold tabular-nums"

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 space-y-4 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Session DNA</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => void shareSummary()}
            className="p-2 rounded-lg bg-secondary text-secondary-foreground active:scale-95 transition-transform"
            aria-label="Share summary"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void downloadPng()}
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
            value={score}
            max={100}
            size={ringSize}
            thickness={thickness}
            progressClassName={scoreTint}
            spring
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(scoreTextClass, scoreFg)}>{score}</span>
            <span className="text-typo-micro font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Form
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-typo-caption text-muted-foreground leading-snug">
            Form-weighted reps and per-rep quality — shareable summary.
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-secondary/50 py-1.5">
              <div className="text-base font-bold tabular-nums text-foreground">{reps}</div>
              <div className="text-typo-micro font-bold uppercase tracking-[0.12em] text-muted-foreground">Reps</div>
            </div>
            <div className="rounded-lg bg-metric-move/10 py-1.5">
              <div className="text-base font-bold tabular-nums text-metric-move">{effectiveReps.toFixed(1)}</div>
              <div className="text-typo-micro font-bold uppercase tracking-[0.12em] text-muted-foreground">Eff.</div>
            </div>
            <div className="rounded-lg bg-metric-coach/10 py-1.5">
              <div className="text-base font-bold tabular-nums text-metric-coach">{avgRep}%</div>
              <div className="text-typo-micro font-bold uppercase tracking-[0.12em] text-muted-foreground">Avg</div>
            </div>
          </div>
        </div>
      </div>

      {(verifiedMovement || faceVerifiedSession) && (
        <div className="flex flex-wrap gap-2">
          {verifiedMovement && (
            <span className="text-typo-eyebrow font-bold uppercase tracking-[0.12em] rounded-full bg-metric-move/15 text-metric-move px-2 py-0.5">
              Verified movement
            </span>
          )}
          {faceVerifiedSession && (
            <span className="text-typo-eyebrow font-bold uppercase tracking-[0.12em] rounded-full bg-metric-spo2/15 text-metric-spo2 px-2 py-0.5">
              Face-verified
            </span>
          )}
        </div>
      )}

      {repScores.length > 0 && (
        <div className="flex items-end gap-0.5 h-14 pt-2 border-t border-border">
          {repScores.slice(0, 32).map((s, i) => {
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

      {motionDna && (
        <div className="pt-3 border-t border-border space-y-1">
          <p className="text-typo-eyebrow font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Movement DNA
          </p>
          <MotionDnaRadar dna={motionDna} size={120} />
        </div>
      )}
    </div>
  )
}
