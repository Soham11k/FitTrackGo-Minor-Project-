"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME, categoryColor } from "@/lib/app-chrome"

interface CategoryChipProps {
  label: string
  active?: boolean
  onClick?: () => void
  /** Override accent; defaults to categoryColor(label) */
  color?: string
}

/**
 * Pill chip for category rails (Strength / Cardio / Mobility / All).
 * Active = orange fill; inactive = dark muted.
 */
export function CategoryChip({ label, active = false, onClick, color }: CategoryChipProps) {
  const reduce = useReducedMotion() ?? false
  const accent = color ?? categoryColor(label)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors"
      style={
        active
          ? { backgroundColor: accent, color: CHROME.white }
          : { backgroundColor: CHROME.focusBg, color: CHROME.muted, border: `1px solid ${CHROME.border}` }
      }
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={{ duration: 0.12 }}
    >
      {label}
    </motion.button>
  )
}
