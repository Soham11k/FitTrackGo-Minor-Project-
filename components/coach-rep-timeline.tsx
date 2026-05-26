"use client"

/**
 * Lightweight “replay”: per-rep form scores as a scrubbable bar row (no video).
 */
import type { RepTracePair } from "@/lib/rep-trace"
import { InteractiveCue } from "@/components/coach/interactive-cue"

export function CoachRepTimeline({
  repScores,
  selectedRep,
  onRepSelect,
  label = "Rep timeline",
  repTraces,
}: {
  repScores: number[]
  selectedRep: number | null
  onRepSelect?: (repIndex: number) => void
  label?: string
  repTraces?: RepTracePair[]
}) {
  if (repScores.length === 0) return null

  const maxScore = Math.max(...repScores, 1)
  const minV = Math.min(...repScores)
  const maxV = Math.max(...repScores)
  const avgV = Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length)

  return (
    <div className="w-full space-y-2">
      <p className="text-typo-caption font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="text-typo-caption text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">Min {minV}</span>
        <span className="mx-2 text-muted-foreground/50">·</span>
        <span className="font-semibold text-foreground">Avg {avgV}</span>
        <span className="mx-2 text-muted-foreground/50">·</span>
        <span className="font-semibold text-foreground">Max {maxV}</span>
        <span className="ml-2 text-typo-eyebrow font-medium uppercase tracking-wider">form %</span>
      </p>
      <div
        className="flex gap-1.5 items-end h-24 px-1"
        aria-label="Form score per rep; tap a rep for details"
      >
        {repScores.map((score, i) => {
          const h = Math.max(12, Math.round((score / maxScore) * 100))
          const selected = selectedRep === i
          const hue =
            score >= 80 ? "bg-primary" : score >= 60 ? "bg-chart-4" : "bg-destructive/80"
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[24px] max-w-[44px]">
              <button
                type="button"
                onClick={() => onRepSelect?.(i)}
                className={`w-full rounded-t-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected ? "ring-2 ring-offset-2 ring-offset-background ring-primary" : ""
                }`}
                style={{ height: `${h}px` }}
                aria-label={`Rep ${i + 1}, form ${score}%`}
                aria-pressed={selected}
              >
                <div className={`h-full w-full rounded-t-md ${hue} opacity-90 hover:opacity-100`} />
              </button>
              <span className="text-typo-eyebrow font-bold tabular-nums text-muted-foreground">{score}</span>
            </div>
          )
        })}
      </div>
      {selectedRep != null && repScores[selectedRep] != null && (
        <p className="text-xs text-muted-foreground text-center" aria-live="polite">
          Rep <strong className="text-foreground">{selectedRep + 1}</strong>:{" "}
          <strong className="text-foreground">{repScores[selectedRep]}%</strong> form
        </p>
      )}

      {selectedRep != null && repTraces?.length ? (
        (() => {
          const trace = repTraces.find((t) => t.rep === selectedRep + 1)
          if (!trace) return null
          const faults = Array.from(new Set([...trace.bottom.faults, ...trace.top.faults].map((f) => f.trim()).filter(Boolean)))
            .slice(0, 4)
          if (!faults.length) return null

          return (
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground text-center">
                Tappable improve cues (this rep)
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {faults.map((f) => (
                  <InteractiveCue key={f} text={f} kind="improve" className="mx-0 rounded-lg px-2 py-1 text-[0.8125rem] font-semibold" />
                ))}
              </div>
            </div>
          )
        })()
      ) : null}
    </div>
  )
}
