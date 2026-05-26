"use client"

import { cn } from "@/lib/utils"

export function FittrackWordmark({
  className,
  tone = "default",
}: {
  className?: string
  tone?: "default" | "stage"
}) {
  const fg = tone === "stage" ? "text-[color:var(--surface-stage-fg)]" : "text-foreground"
  const muted = tone === "stage" ? "text-[color:oklch(0.92_0_0/0.55)]" : "text-muted-foreground"

  return (
    <span
      className={cn("inline-flex items-baseline leading-none", fg, className)}
      style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
    >
      <span className="text-[0.92em] font-bold uppercase tracking-[0.06em]">FitTrack</span>
      <span className={cn("ml-1.5 text-[0.92em] font-bold uppercase tracking-[0.06em]", muted)}>Go</span>
    </span>
  )
}
