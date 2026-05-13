"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared full-bleed "stage" canvas using `--surface-stage` tokens from globals.css.
 * Optional accent vignette and top-right slot (e.g. brand mark).
 */
export function CinematicStage({
  children,
  className,
  vignette = true,
  brandMark,
  role = "region",
}: {
  children: ReactNode
  className?: string
  /** Soft primary glow corners */
  vignette?: boolean
  brandMark?: ReactNode
  role?: "region" | "presentation"
}) {
  return (
    <div
      role={role}
      className={cn(
        "relative flex flex-col bg-[color:var(--surface-stage)] text-[color:var(--surface-stage-fg)]",
        vignette && "surface-stage-gradient",
        className,
      )}
    >
      {brandMark ? (
        <div className="pointer-events-none absolute right-4 top-4 z-[1] opacity-40">{brandMark}</div>
      ) : null}
      {children}
    </div>
  )
}
