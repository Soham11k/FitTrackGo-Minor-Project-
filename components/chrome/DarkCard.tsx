"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME } from "@/lib/app-chrome"
import { cn } from "@/lib/utils"

interface DarkCardProps {
  children: React.ReactNode
  className?: string
  delay?: number
  noAnimation?: boolean
}

/**
 * Dark panel — used in Arena, Coach picker, settings rows, and any
 * section that lives on the black shell instead of the cream body.
 */
export function DarkCard({ children, className, delay = 0, noAnimation = false }: DarkCardProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <motion.div
      className={cn("rounded-2xl p-4", className)}
      style={{ backgroundColor: CHROME.cardBg, border: `1px solid ${CHROME.border}` }}
      initial={noAnimation || reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
