"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export function StatDisplay({
  eyebrow,
  value,
  unit,
  secondary,
  size = "md",
  tone = "default",
  className,
  icon,
  layoutId,
  valueClassName,
  contentClassName,
  eyebrowClassName,
}: {
  eyebrow?: string
  value: ReactNode
  unit?: string
  secondary?: string
  size?: "md" | "lg"
  tone?: "default" | "stage"
  className?: string
  icon?: ReactNode
  layoutId?: string
  /** Override value color (e.g. metric tints on cards). */
  valueClassName?: string
  /** Row layout for icon + value (e.g. justify-start for left-aligned heroes). */
  contentClassName?: string
  eyebrowClassName?: string
}) {
  const sizeClass = size === "lg" ? "text-display-stat-lg" : "text-display-stat"
  const fg =
    tone === "stage" ? "text-[color:var(--surface-stage-fg)]" : "text-foreground"
  const muted = tone === "stage" ? "text-[color:oklch(0.92_0_0/0.65)]" : "text-muted-foreground"
  const eyebrowCls = cn("text-typo-eyebrow font-bold uppercase tracking-[0.2em]", muted)

  const inner = (
    <>
      {eyebrow ? <p className={cn(eyebrowCls, eyebrowClassName)}>{eyebrow}</p> : null}
      <div className={cn("flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0", icon && "items-center", contentClassName)}>
        {icon ? <span className="shrink-0 opacity-80">{icon}</span> : null}
        <span className={cn(sizeClass, fg, valueClassName)}>{value}</span>
        {unit ? (
          <span className={cn("text-typo-micro font-bold uppercase tracking-wider tabular-nums", muted)}>{unit}</span>
        ) : null}
      </div>
      {secondary ? <p className={cn("mt-0.5 text-typo-caption", muted)}>{secondary}</p> : null}
    </>
  )

  if (layoutId) {
    return (
      <motion.div layout="position" layoutId={layoutId} className={cn("text-center", className)}>
        {inner}
      </motion.div>
    )
  }

  return <div className={cn("text-center", className)}>{inner}</div>
}
