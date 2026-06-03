"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME_ACCENT } from "@/lib/chrome-accent"

/**
 * Soft drifting accent glow orbs — fixed behind non-black-shell tabs.
 * Colors follow the user's accent preset via CSS variables.
 */
export function AmbientBackdrop() {
  const reduce = useReducedMotion() ?? false

  if (reduce) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[20%] top-[6%] h-[min(480px,70vw)] w-[min(480px,70vw)] rounded-full blur-[90px]"
        style={{ backgroundColor: CHROME_ACCENT.glow }}
        animate={{ x: [0, 24, 0], y: [0, -18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[15%] top-[35%] h-[min(400px,55vw)] w-[min(400px,55vw)] rounded-full blur-[80px]"
        style={{ backgroundColor: CHROME_ACCENT.glow }}
        animate={{ x: [0, -20, 0], y: [0, 14, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <motion.div
        className="absolute bottom-[15%] left-[10%] h-[min(360px,50vw)] w-[min(360px,50vw)] rounded-full blur-[72px]"
        style={{ backgroundColor: CHROME_ACCENT.glow }}
        animate={{ x: [0, 16, 0], y: [0, 10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
    </div>
  )
}
