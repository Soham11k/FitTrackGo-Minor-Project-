"use client"

import type { RepCoachFeedback } from "@/lib/ai-coach/clip-review"
import { CheckCircle2, TrendingUp } from "lucide-react"
import { InteractiveCue } from "@/components/coach/interactive-cue"

type Props = {
  feedback: RepCoachFeedback
  /** On-device faults to show when AI improve list differs */
  onDeviceImprove?: string[]
  /** When true, label as live coach notes vs AI review */
  source?: "local" | "ai"
}

export function RepFeedbackCard({ feedback, onDeviceImprove, source = "ai" }: Props) {
  const { repIndex, good, improve } = feedback
  const extraOnDevice =
    onDeviceImprove?.filter((f) => !improve.some((i) => i.toLowerCase() === f.toLowerCase())) ?? []

  return (
    <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5 space-y-3">
      <p className="text-typo-eyebrow font-bold uppercase tracking-wide text-muted-foreground">
        Rep {repIndex + 1}
        {source === "local" ? (
          <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/80">
            · on-device notes
          </span>
        ) : (
          <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/80">
            · AI review
          </span>
        )}
      </p>

      {good.length > 0 ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-metric-move">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            What went well
          </div>
          <ul className="mt-1 space-y-0.5 text-sm leading-snug text-foreground/90">
            {good.map((g, idx) => (
              <InteractiveCue key={idx} text={g} kind="good" as="li" />
            ))}
          </ul>
        </div>
      ) : null}

      {improve.length > 0 ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-metric-streak">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            What to improve
          </div>
          <ul className="mt-1 space-y-0.5 text-sm leading-snug text-foreground/90">
            {improve.map((item, idx) => (
              <InteractiveCue key={idx} text={item} kind="improve" as="li" />
            ))}
          </ul>
        </div>
      ) : good.length === 0 ? (
        <p className="text-xs text-muted-foreground">No specific cues for this rep yet.</p>
      ) : null}

      {source === "ai" && extraOnDevice.length > 0 ? (
        <div className="border-t border-border/60 pt-2 space-y-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Coach also noticed
          </p>
          <ul className="space-y-0.5">
            {extraOnDevice.map((f, idx) => (
              <InteractiveCue
                key={idx}
                text={f}
                kind="improve"
                as="li"
                className="text-[0.6875rem] leading-snug text-muted-foreground"
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
