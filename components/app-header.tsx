"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { CHROME } from "@/lib/app-chrome"
import { EcgMark } from "@/components/chrome/EcgMark"
import { LOGO_INTRO } from "@/lib/motion"

export function AppHeader({
  streakChip,
  guest,
  right,
  className,
}: {
  streakChip?: ReactNode
  guest?: boolean
  right?: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion() ?? false

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 backdrop-blur-md",
        className,
      )}
      style={{
        backgroundColor: "rgba(13,13,13,0.92)",
        borderBottom: `1px solid ${CHROME.border}`,
      }}
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Brand mark */}
      <motion.div
        className="flex min-w-0 items-center gap-2"
        variants={LOGO_INTRO}
        initial="hidden"
        animate="show"
      >
        <EcgMark size={18} animate />
        <span
          className="text-[12px] font-bold uppercase tracking-[0.22em] truncate"
          style={{ color: CHROME.white }}
        >
          FitTrack Go
        </span>
      </motion.div>

      {/* Right-side chips */}
      <div className="flex shrink-0 items-center gap-2">
        {right}
        {guest && (
          <span
            className="rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: CHROME.muted, border: `1px solid ${CHROME.border}` }}
          >
            Guest
          </span>
        )}
        {streakChip}
      </div>
    </motion.header>
  )
}
