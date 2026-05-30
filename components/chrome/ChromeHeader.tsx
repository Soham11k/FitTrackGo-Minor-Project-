"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME } from "@/lib/app-chrome"
import { EcgMark } from "./EcgMark"

interface ChromeHeaderProps {
  /** Shown right of the ECG mark + wordmark */
  right?: React.ReactNode
  guest?: boolean
  streakDays?: number
  /** Extra className on the outer header element */
  className?: string
  /** Safe-area top padding (default: true) */
  safeTop?: boolean
}

/**
 * Full-width dark chrome header row.
 * Used as the embedded header on Run, Train, Arena, Coach, and Profile —
 * and as the replacement for the global AppHeader on those tabs.
 */
export function ChromeHeader({
  right,
  guest,
  streakDays = 0,
  className = "",
  safeTop = true,
}: ChromeHeaderProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <motion.header
      className={`flex items-center justify-between px-4 py-3 ${className}`}
      style={{
        backgroundColor: CHROME.black,
        paddingTop: safeTop ? "max(0.75rem, env(safe-area-inset-top))" : undefined,
      }}
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Brand mark */}
      <div className="flex items-center gap-1.5">
        <EcgMark size={16} animate />
        <span
          className="text-[11px] font-bold uppercase tracking-[0.22em]"
          style={{ color: CHROME.white }}
        >
          FitTrack Go
        </span>
      </div>

      {/* Right-side status */}
      <div className="flex items-center gap-2">
        {right}
        {guest && (
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: CHROME.muted }}
          >
            Guest
          </span>
        )}
        {streakDays > 0 && (
          <motion.span
            className="rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white"
            style={{ backgroundColor: CHROME.orange }}
            animate={reduce ? undefined : { opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            {streakDays}D Streak
          </motion.span>
        )}
      </div>
    </motion.header>
  )
}
