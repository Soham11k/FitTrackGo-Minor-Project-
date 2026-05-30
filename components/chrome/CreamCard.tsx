"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME } from "@/lib/app-chrome"
import { cn } from "@/lib/utils"

interface CreamCardProps {
  children: React.ReactNode
  className?: string
  delay?: number
  /** Disables the stagger mount animation */
  noAnimation?: boolean
}

/**
 * White/cream data card — the standard data surface across Home, Profile, History.
 * Fades + slides up on mount; respects prefers-reduced-motion.
 */
export function CreamCard({ children, className, delay = 0, noAnimation = false }: CreamCardProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <motion.div
      className={cn(
        "rounded-[1.35rem] border p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]",
        className,
      )}
      style={{ backgroundColor: CHROME.card, borderColor: CHROME.cardBorder }}
      initial={noAnimation || reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
