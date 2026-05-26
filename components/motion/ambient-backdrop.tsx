"use client"

import { motion, useReducedMotion } from "framer-motion"

/**
 * Soft drifting gradients behind main app chrome (home / tabs).
 * Fixed, pointer-events-none, respects reduced motion.
 */
export function AmbientBackdrop() {
  const reduce = useReducedMotion() ?? false

  if (reduce) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[20%] top-[8%] h-[min(480px,70vw)] w-[min(480px,70vw)] rounded-full bg-primary/[0.07] blur-[80px]"
        animate={{ x: [0, 24, 0], y: [0, -18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[15%] top-[35%] h-[min(400px,55vw)] w-[min(400px,55vw)] rounded-full bg-[oklch(0.72_0.14_250/0.06)] blur-[72px]"
        animate={{ x: [0, -20, 0], y: [0, 14, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <motion.div
        className="absolute bottom-[18%] left-[10%] h-[min(360px,50vw)] w-[min(360px,50vw)] rounded-full bg-primary/[0.04] blur-[64px]"
        animate={{ x: [0, 16, 0], y: [0, 10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
    </div>
  )
}
