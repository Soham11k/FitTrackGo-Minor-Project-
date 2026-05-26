"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { FittrackBrandLockup } from "@/components/brand/fittrack-brand-lockup"
import { LOGO_INTRO } from "@/lib/motion"

export function AppHeader({
  streakChip,
  guest,
  right,
  className,
}: {
  /** Shown when streak &gt; 0 (or override with null to hide) */
  streakChip?: ReactNode
  guest?: boolean
  /** Tab-specific slot (GPS, coach faults, etc.) */
  right?: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion() ?? false
  return (
    <motion.header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md",
        className,
      )}
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <motion.div variants={LOGO_INTRO} initial="hidden" animate="show" className="shrink-0" aria-hidden>
          <FittrackBrandLockup
            markSize={28}
            layout="inline"
            wordmarkClassName="truncate"
          />
        </motion.div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {guest ? (
          <span className="rounded-sm border border-border bg-transparent px-2 py-0.5 text-typo-micro font-bold uppercase tracking-[0.18em] text-foreground tabular-nums">
            Guest
          </span>
        ) : null}
        {right ?? streakChip}
      </div>
    </motion.header>
  )
}
