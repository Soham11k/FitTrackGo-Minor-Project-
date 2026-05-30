"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME } from "@/lib/app-chrome"

/**
 * Soft drifting orange glow orbs — fixed behind all app chrome.
 * Replaces the old volt-green blurs with brand-aligned orange.
 * Pointer-events-none; respects prefers-reduced-motion.
 */
export function AmbientBackdrop() {
  const reduce = useReducedMotion() ?? false

  if (reduce) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Top-left warm glow */}
      <motion.div
        className="absolute -left-[20%] top-[6%] h-[min(480px,70vw)] w-[min(480px,70vw)] rounded-full blur-[90px]"
        style={{ backgroundColor: `${CHROME.orange}0d` }}
        animate={{ x: [0, 24, 0], y: [0, -18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Right-mid cooler accent (teal) */}
      <motion.div
        className="absolute -right-[15%] top-[35%] h-[min(400px,55vw)] w-[min(400px,55vw)] rounded-full blur-[80px]"
        style={{ backgroundColor: `${CHROME.teal}08` }}
        animate={{ x: [0, -20, 0], y: [0, 14, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      {/* Bottom warm accent */}
      <motion.div
        className="absolute bottom-[15%] left-[10%] h-[min(360px,50vw)] w-[min(360px,50vw)] rounded-full blur-[72px]"
        style={{ backgroundColor: `${CHROME.orange}07` }}
        animate={{ x: [0, 16, 0], y: [0, 10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
    </div>
  )
}
