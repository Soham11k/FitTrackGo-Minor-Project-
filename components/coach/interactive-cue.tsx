"use client"

import { cn } from "@/lib/utils"
import type { HighlightKind } from "@/lib/coach-vision/cue-resolver"
import { useCueFocusOptional } from "@/components/coach/cue-focus-context"

type Props = {
  text: string
  kind: HighlightKind
  className?: string
  /** When no provider, render static text */
  as?: "li" | "button"
}

export function InteractiveCue({ text, kind, className, as = "button" }: Props) {
  const ctx = useCueFocusOptional()
  const pressed = ctx?.isCueFocused(text, kind) ?? false

  if (!ctx) {
    if (as === "li") {
      return <li className={className}>{text}</li>
    }
    return <span className={className}>{text}</span>
  }

  const base =
    kind === "good"
      ? "text-left rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-metric-move/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-move/50"
      : "text-left rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-metric-streak/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-streak/50"

  if (as === "li") {
    return (
      <li>
        <button
          type="button"
          aria-pressed={pressed}
          onClick={() => ctx.toggleCue(text, kind)}
          className={cn(base, pressed && (kind === "good" ? "bg-metric-move/20 ring-1 ring-metric-move/40" : "bg-metric-streak/20 ring-1 ring-metric-streak/40"), className)}
        >
          {text}
        </button>
      </li>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => ctx.toggleCue(text, kind)}
      className={cn(base, pressed && (kind === "good" ? "bg-metric-move/20 ring-1 ring-metric-move/40" : "bg-metric-streak/20 ring-1 ring-metric-streak/40"), className)}
    >
      {text}
    </button>
  )
}
