"use client"

import { cn } from "@/lib/utils"

export type PbStickerVariant = "pb-distance" | "pb-pace" | "pb-form-score"

const variantStyles: Record<PbStickerVariant, string> = {
  "pb-distance":
    "border-amber-500/55 bg-gradient-to-br from-amber-500/25 to-amber-600/15 text-[color:var(--surface-stage-fg)] shadow-[0_0_20px_-4px_rgb(251_191_36/0.5)]",
  "pb-pace":
    "border-primary/55 bg-gradient-to-br from-primary/35 to-primary/10 text-[color:var(--surface-stage-fg)] shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--primary)_45%,transparent)]",
  "pb-form-score":
    "border-chart-4/55 bg-gradient-to-br from-chart-4/35 to-chart-4/15 text-[color:var(--surface-stage-fg)] shadow-[0_0_20px_-4px_rgb(250_204_21/0.35)]",
}

const labels: Record<PbStickerVariant, string> = {
  "pb-distance": "PERSONAL BEST",
  "pb-pace": "PR PACE",
  "pb-form-score": "PB FORM",
}

export function PbSticker({
  variant,
  label,
  className,
}: {
  variant: PbStickerVariant
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "text-typo-eyebrow inline-block -rotate-6 rounded-full border px-3 py-1.5 font-extrabold uppercase tracking-[0.24em]",
        variantStyles[variant],
        className,
      )}
      style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
    >
      {label ?? labels[variant]}
    </span>
  )
}
