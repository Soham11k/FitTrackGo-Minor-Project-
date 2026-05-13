"use client"

import { Sparkles } from "lucide-react"

interface AiConfidenceBadgeProps {
  active: boolean
  label?: string
}

/**
 * Small chip surfaced in the HUD when the form score came from the
 * AI-fallback path (no FormSpec for this exercise). Lower-confidence
 * relative to the rule-based engine, so we say so out loud.
 */
export function AiConfidenceBadge({ active, label = "AI-estimated" }: AiConfidenceBadgeProps) {
  if (!active) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  )
}
